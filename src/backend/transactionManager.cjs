const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { TRANSACTION_PROCESSORS } = require('./processors/transactionProcessors');
const dbService = require('./database/databaseService');

async function calculateFileHash(filePath) {
  const content = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
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
      try {
        const stmt = await this.db.prepare(`
          INSERT INTO transactions (
            global_id, account_id, date, posted_date, amount, 
            description, type, balance, principal_amount, 
            interest_amount, escrow_amount, category, card_number, raw_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const tx of transactions) {
          const globalId = `${accountId}_${tx.date.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
          await stmt.run([
            globalId, accountId, tx.date.toISOString(),
            tx.postedDate?.toISOString() || null, tx.amount,
            tx.description, tx.type, tx.balance || null,
            tx.principalAmount || null, tx.interestAmount || null,
            tx.escrowAmount || null, tx.category || null,
            tx.cardNumber || null, JSON.stringify(tx.raw)
          ]);
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
          transactionsAdded: transactions.length,
          dateRange: {
            start: new Date(Math.min(...dates)).toISOString(),
            end: new Date(Math.max(...dates)).toISOString()
          }
        });
        await this.dataManager.saveManifest();

        return { success: true, count: transactions.length };
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
}

module.exports = TransactionManager;
