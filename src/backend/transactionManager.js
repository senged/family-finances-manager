const fs = require('fs').promises;
const path = require('path');
const { TRANSACTION_PROCESSORS } = require('./processors/transactionProcessors');
const { initializeDatabase } = require('./database/initializeDatabase');

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

  async storeCentralTransactions(accountId, transactions) {
    await this.initialize();

    // Begin transaction
    await this.db.run('BEGIN TRANSACTION');

    try {
      // Prepare statement once
      const stmt = await this.db.prepare(`
        INSERT INTO transactions (
          global_id, account_id, date, posted_date, amount,
          description, category, type, balance,
          principal_amount, interest_amount, escrow_amount,
          card_number, merchant_category,
          raw_data, processing_metadata, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(global_id) DO UPDATE SET
          updated_at = excluded.updated_at,
          processing_metadata = excluded.processing_metadata
      `);

      // Process all transactions
      for (const transaction of transactions) {
        const {
          date, postedDate, amount, description, category,
          type, balance, components, cardNumber,
          merchantCategory, raw, processing
        } = transaction;

        await stmt.run(
          `${accountId}_${processing.hash}`,
          accountId,
          date.toISOString(),
          postedDate?.toISOString(),
          amount,
          description,
          category,
          type,
          balance,
          components?.principal,
          components?.interest,
          components?.escrow,
          cardNumber,
          merchantCategory,
          JSON.stringify(raw),
          JSON.stringify(processing),
          new Date().toISOString()
        );
      }

      // Finalize statement and commit
      await stmt.finalize();
      await this.db.run('COMMIT');

    } catch (error) {
      // Rollback on error
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  // Add error handling wrapper
  async query(callback) {
    try {
      await this.initialize();
      return await callback(this.db);
    } catch (error) {
      console.error('Database error:', error);
      throw error;
    }
  }

  async getTransactions(filters) {
    // ... existing query building ...
    
    // Add partner information to the results
    const transactions = await this.db.all(query, params);
    
    // Fetch partners for all transactions
    const partnerPromises = transactions.map(tx => 
      this.partnerManager.getTransactionPartners(tx.global_id)
    );
    const partners = await Promise.all(partnerPromises);
    
    // Merge partner information into transactions
    return transactions.map((tx, i) => ({
      ...tx,
      partners: partners[i]
    }));
  }
} 