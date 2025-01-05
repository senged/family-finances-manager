const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { TRANSACTION_PROCESSORS } = require('./processors/transactionProcessors');
const { initializeDatabase } = require('./database/initializeDatabase');

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
    if (!this.db) {
      this.db = await initializeDatabase(this.dataManager.getDataPath());
    }
  }

  async syncAccounts() {
    const manifest = this.dataManager.getManifest();

    // First verify the accounts table exists
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        processor_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id)
      )
    `);

    await this.db.run('BEGIN TRANSACTION');
    try {
      // First, get all existing accounts
      const existingAccounts = await this.db.all('SELECT id FROM accounts');
      const existingIds = new Set(existingAccounts.map(a => a.id));

      // Insert/update each account
      for (const account of manifest.accounts) {
        console.log(`Syncing account ${account.id} (${account.name})`);
        await this.db.run(`
          INSERT OR REPLACE INTO accounts (
            id, 
            name, 
            type, 
            processor_id,
            updated_at
          ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
          account.id,
          account.name,
          account.type,
          account.processorId
        ]);

        // Verify the account was actually inserted
        const verifyAccount = await this.db.get('SELECT id FROM accounts WHERE id = ?', [account.id]);
        if (!verifyAccount) {
          throw new Error(`Failed to sync account ${account.id}`);
        }
      }

      // Log the final state for debugging
      const finalAccounts = await this.db.all('SELECT * FROM accounts');
      console.log('Synced accounts:', finalAccounts);

      await this.db.run('COMMIT');
    } catch (error) {
      console.error('Error syncing accounts:', error);
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async importTransactions({ accountId, filePath }) {
    try {
      await this.initialize();
      
      // Always sync accounts before importing transactions
      await this.syncAccounts();

      // Get account details
      const account = this.dataManager.getManifest().accounts.find(a => a.id === accountId);
      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      // Verify account exists in database
      const dbAccount = await this.db.get('SELECT * FROM accounts WHERE id = ?', [accountId]);
      if (!dbAccount) {
        console.error('Account not found in database:', accountId);
        console.error('Current accounts in database:', await this.db.all('SELECT * FROM accounts'));
        throw new Error(`Account ${accountId} exists in manifest but not in database. Database sync may have failed.`);
      }
      console.log('Found account in database:', dbAccount);

      // Calculate file hash
      const fileHash = await calculateFileHash(filePath);
      
      // Check if file was already imported
      if (account.imports?.some(imp => imp.fileHash === fileHash)) {
        console.log('This exact file has already been imported, skipping');
        return { success: true, count: 0, skipped: true };
      }

      // Process the file
      const processor = TRANSACTION_PROCESSORS[account.processorId];
      if (!processor) {
        throw new Error(`Processor not found: ${account.processorId}`);
      }

      const transactions = await processor.processFile(filePath);
      console.log(`Processed ${transactions.length} transactions from file`);

      // Store in SQLite
      await this.db.run('BEGIN TRANSACTION');
      try {
        // Insert each transaction
        const stmt = await this.db.prepare(`
          INSERT INTO transactions (
            global_id,
            account_id,
            date,
            posted_date,
            amount,
            description,
            type,
            balance,
            principal_amount,
            interest_amount,
            escrow_amount,
            category,
            card_number,
            raw_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const tx of transactions) {
          const globalId = `${accountId}_${tx.date.getTime()}_${Math.random().toString(36).substr(2, 9)}`;
          
          try {
            await stmt.run([
              globalId,
              accountId,
              tx.date.toISOString(),
              tx.postedDate?.toISOString() || null,
              tx.amount,
              tx.description,
              tx.type,
              tx.balance || null,
              tx.principalAmount || null,
              tx.interestAmount || null,
              tx.escrowAmount || null,
              tx.category || null,
              tx.cardNumber || null,
              JSON.stringify(tx.raw)
            ]);
          } catch (err) {
            console.error('Error inserting transaction:', {
              globalId,
              accountId,
              date: tx.date.toISOString(),
              description: tx.description,
              error: err.message
            });
            throw err;
          }
        }

        await stmt.finalize();
        await this.db.run('COMMIT');

        // Record import in FFM
        const dates = transactions.map(tx => new Date(tx.date).getTime());
        const startDate = new Date(Math.min(...dates));
        const endDate = new Date(Math.max(...dates));

        const importRecord = {
          originalFileName: path.basename(filePath),
          importedAt: new Date().toISOString(),
          fileHash,
          transactionsAdded: transactions.length,
          dateRange: {
            start: startDate.toISOString(),
            end: endDate.toISOString()
          }
        };

        account.imports = account.imports || [];
        account.imports.push(importRecord);
        await this.dataManager.saveManifest();

        return {
          success: true,
          count: transactions.length
        };
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
      await this.initialize();

      let query = `
        SELECT t.*, a.name as account_name 
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        query += ' AND t.date >= ?';
        params.push(startDate);
      }

      if (endDate) {
        query += ' AND t.date <= ?';
        params.push(endDate);
      }

      if (description) {
        query += ' AND LOWER(t.description) LIKE LOWER(?)';
        params.push(`%${description}%`);
      }

      // Handle array of account IDs
      if (Array.isArray(accountId) && accountId.length > 0) {
        const placeholders = accountId.map(() => '?').join(',');
        query += ` AND t.account_id IN (${placeholders})`;
        params.push(...accountId);
      } else if (typeof accountId === 'string') {
        // Handle single account ID for backwards compatibility
        query += ' AND t.account_id = ?';
        params.push(accountId);
      }

      query += ' ORDER BY t.date DESC, t.global_id DESC';

      const transactions = await this.db.all(query, params);
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }
}

module.exports = TransactionManager; 