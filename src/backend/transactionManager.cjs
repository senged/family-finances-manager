const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { TRANSACTION_PROCESSORS } = require('./processors/transactionProcessors');
const dbService = require('./database/databaseService');

async function calculateFileHash(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function generateDeterministicId(tx, accountId) {
  const data = [
    accountId,
    tx.date instanceof Date ? tx.date.toISOString() : tx.date,
    tx.amount.toFixed(2),
    tx.description,
    tx.balance ? tx.balance.toFixed(2) : '',
    tx.cardNumber || '',
    tx.referenceNumber || ''
  ].join('|');

  return crypto.createHash('sha256').update(data).digest('hex');
}

class TransactionManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.db = null;
  }

  async initialize() {
    this.db = await dbService.getDb();
  }

  async importTransactions({ accountId, filePath }) {
    try {
      if (!this.db) await this.initialize();

      const account = this.dataManager.getManifest().accounts.find(a => a.id === accountId);
      if (!account) throw new Error(`Account not found: ${accountId}`);

      const fileHash = await calculateFileHash(filePath);
      if (account.imports?.some(imp => imp.fileHash === fileHash)) {
        return { success: true, count: 0, skipped: true };
      }

      const processor = TRANSACTION_PROCESSORS[account.processorId];
      if (!processor) throw new Error(`Processor not found: ${account.processorId}`);

      const transactions = await processor.processFile(filePath);

      await this.db.run('BEGIN TRANSACTION');
      let transactionsAdded = 0;
      try {
        const stmt = await this.db.prepare(`
          INSERT OR IGNORE INTO transactions (
            global_id, account_id, date, posted_date, amount, 
            description, type, balance, principal_amount, 
            interest_amount, escrow_amount, category, card_number, raw_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const tx of transactions) {
          const globalId = generateDeterministicId(tx, accountId);
          const result = await stmt.run([
            globalId, accountId, tx.date.toISOString(),
            tx.postedDate?.toISOString() || null, tx.amount,
            tx.description, tx.type, tx.balance || null,
            tx.principalAmount || null, tx.interestAmount || null,
            tx.escrowAmount || null, tx.category || null,
            tx.cardNumber || null, JSON.stringify(tx.raw)
          ]);

          if (result.changes > 0) {
            transactionsAdded++;
          }
        }

        await stmt.finalize();
        await this.db.run('COMMIT');

        // Record import in manifest
        const dates = transactions.map(tx => new Date(tx.date).getTime());
        account.imports = account.imports || [];
        account.imports.push({
          originalFileName: path.basename(filePath),
          importedAt: new Date().toISOString(),
          fileHash,
          transactionsAdded,
          dateRange: {
            start: new Date(Math.min(...dates)).toISOString(),
            end: new Date(Math.max(...dates)).toISOString()
          }
        });
        await this.dataManager.saveManifest();

        return { success: true, count: transactionsAdded };
      } catch (error) {
        await this.db.run('ROLLBACK');
        throw error;
      }
    } catch (error) {
      console.error('Error importing transactions:', error);
      throw error;
    }
  }

  async getTransactions({ startDate, endDate, accountId, description }) {
    try {
      if (!this.db) await this.initialize();

      let query = 'SELECT * FROM transactions_view WHERE 1=1';
      const params = [];

      if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
      }
      if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
      }
      if (description) {
        query += ' AND LOWER(description) LIKE LOWER(?)';
        params.push(`%${description}%`);
      }
      if (Array.isArray(accountId) && accountId.length > 0) {
        const placeholders = accountId.map(() => '?').join(',');
        query += ` AND account_id IN (${placeholders})`;
        params.push(...accountId);
      } else if (typeof accountId === 'string') {
        query += ' AND account_id = ?';
        params.push(accountId);
      }

      query += ' ORDER BY date DESC, global_id DESC';
      return await this.db.all(query, params);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async getSummary(filters) {
    try {
      if (!this.db) await this.initialize();

      let whereClause = 'WHERE 1=1';
      const params = [];

      if (filters.startDate) {
        whereClause += ' AND date >= ?';
        params.push(filters.startDate);
      }
      if (filters.endDate) {
        whereClause += ' AND date <= ?';
        params.push(filters.endDate);
      }
      if (filters.accountIds && filters.accountIds.length > 0) {
        const placeholders = filters.accountIds.map(() => '?').join(',');
        whereClause += ` AND account_id IN (${placeholders})`;
        params.push(...filters.accountIds);
      }

      const query = `
        SELECT 
          COUNT(*) as count,
          SUM(CASE WHEN amount > 0 AND type != 'transfer' THEN amount ELSE 0 END) as inflows,
          SUM(CASE WHEN amount < 0 AND type != 'transfer' THEN ABS(amount) ELSE 0 END) as outflows,
          SUM(CASE WHEN type = 'transfer' THEN ABS(amount) ELSE 0 END) as transfers,
          MIN(date) as first_date,
          MAX(date) as last_date
        FROM transactions
        ${whereClause}
      `;

      return await this.db.get(query, params);
    } catch (error) {
      console.error('Error getting summary:', error);
      throw error;
    }
  }

  async deduplicateTransactions() {
    try {
      if (!this.db) await this.initialize();

      console.log('Starting deduplication process...');

      // Get all transactions
      const transactions = await this.db.all('SELECT * FROM transactions');

      const seen = new Map();
      const toDelete = [];

      for (const tx of transactions) {
        // Re-generate deterministic ID based on existing data
        const txData = {
          date: new Date(tx.date),
          amount: tx.amount,
          description: tx.description,
          balance: tx.balance,
          cardNumber: tx.card_number,
          raw_data: JSON.parse(tx.raw_data)
        };

        // Try to find reference number in raw data if not explicitly set
        // (Processors might have different structures, but we use the ones we know)
        txData.referenceNumber = txData.raw_data['Reference Number'] || txData.raw_data['Reference'] || '';

        const newGlobalId = generateDeterministicId(txData, tx.account_id);

        if (seen.has(newGlobalId)) {
          // It's a duplicate of something we've seen (or already exists with this ID)
          // We should mark the ORIGINAL one to be updated with the deterministic ID,
          // and the current one to be deleted if its ID is different.
          toDelete.push(tx.global_id);
        } else {
          seen.set(newGlobalId, tx.global_id);

          if (tx.global_id !== newGlobalId) {
            // Update existing transaction to use the new deterministic ID
            // This is tricky because global_id is a primary key and might be referenced elsewhere (though unlikely currently)
            // Strategy: Insert new, then delete old.
            // But if we already have a record with newGlobalId, we'll just delete the old one.

            // Check if newGlobalId already exists in DB
            const existing = await this.db.get('SELECT global_id FROM transactions WHERE global_id = ?', [newGlobalId]);

            if (existing) {
              toDelete.push(tx.global_id);
            } else {
              // Create new record with same data but new ID
              await this.db.run(`
                INSERT INTO transactions (
                  global_id, account_id, date, posted_date, amount, 
                  description, type, balance, principal_amount, 
                  interest_amount, escrow_amount, category, card_number, raw_data, partner_id
                ) SELECT ?, account_id, date, posted_date, amount, 
                         description, type, balance, principal_amount, 
                         interest_amount, escrow_amount, category, card_number, raw_data, partner_id
                FROM transactions WHERE global_id = ?
              `, [newGlobalId, tx.global_id]);

              toDelete.push(tx.global_id);
            }
          }
        }
      }

      if (toDelete.length > 0) {
        console.log(`Deleting ${toDelete.length} duplicate or migrated transactions...`);
        // Batch delete to avoid long parameter lists
        const batchSize = 500;
        for (let i = 0; i < toDelete.length; i += batchSize) {
          const batch = toDelete.slice(i, i + batchSize);
          const placeholders = batch.map(() => '?').join(',');
          await this.db.run(`DELETE FROM transactions WHERE global_id IN (${placeholders})`, batch);
        }
      }

      console.log('Deduplication process complete.');
      return { success: true, removedCount: toDelete.length };
    } catch (error) {
      console.error('Error during deduplication:', error);
      throw error;
    }
  }
}

module.exports = TransactionManager;
