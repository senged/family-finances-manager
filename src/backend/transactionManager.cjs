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
      // Sync accounts from manifest to database
      await this.syncAccounts();
    }
  }

  async syncAccounts() {
    const manifest = this.dataManager.getManifest();
    if (!manifest || !manifest.accounts) return;

    await this.db.run('BEGIN TRANSACTION');
    try {
      // Insert/update each account
      for (const account of manifest.accounts) {
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
      }
      await this.db.run('COMMIT');
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  async importTransactions({ accountId, filePath }) {
    try {
      await this.initialize();

      console.log('Importing transactions for account:', accountId);
      console.log('Account from manifest:', this.dataManager.getManifest().accounts);

      // Get account details to determine processor
      const account = this.dataManager.getManifest().accounts.find(a => a.id === accountId);
      if (!account) {
        throw new Error(`Account not found: ${accountId}`);
      }

      console.log('Found account:', account);

      // Get account directories
      const { rawDir, transactionsFile } = this.dataManager.accountManager.getAccountPaths(accountId);
      
      // Copy import file to raw directory with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = path.basename(filePath);
      const rawFilePath = path.join(rawDir, `${timestamp}_${fileName}`);
      await fs.copyFile(filePath, rawFilePath);

      // Verify account exists in database
      const dbAccount = await this.db.get('SELECT id FROM accounts WHERE id = ?', accountId);
      if (!dbAccount) {
        await this.syncAccounts(); // Resync if account not found
      }

      // Get the correct processor
      const processor = TRANSACTION_PROCESSORS[account.processorId];
      if (!processor) {
        throw new Error(`Processor not found: ${account.processorId}`);
      }

      // Process the copied file
      const transactions = await processor.processFile(rawFilePath);

      // Append to local CSV file
      const csvLines = transactions.map(tx => {
        return [
          tx.date.toISOString(),
          tx.postedDate?.toISOString() || '',
          tx.amount,
          `"${tx.description.replace(/"/g, '""')}"`, // Escape quotes in description
          tx.type,
          tx.balance || '',
          tx.principalAmount || '',
          tx.interestAmount || '',
          tx.escrowAmount || '',
          tx.category || '',
          tx.cardNumber || '',
          `"${JSON.stringify(tx.raw).replace(/"/g, '""')}"`,
          timestamp,
          fileName
        ].join(',');
      });
      
      await fs.appendFile(transactionsFile, csvLines.join('\n') + '\n');

      // Begin transaction for central DB
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
        }

        await stmt.finalize();
        await this.db.run('COMMIT');

        // Run verification after successful import
        console.log('\nRunning import verification...');
        const verificationResult = await this.verifyImport(accountId);
        console.log('\nImport completed successfully:', {
          transactionsImported: transactions.length,
          verification: verificationResult
        });

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

  async verifyImport(accountId) {
    console.log('\n=== Import Verification Report ===\n');

    // 1. Check account in manifest
    const manifest = this.dataManager.getManifest();
    const account = manifest.accounts.find(a => a.id === accountId);
    console.log('1. Account in Manifest:', {
      found: !!account,
      details: account
    });

    // 2. Check account in SQLite
    const dbAccount = await this.db.get(
      'SELECT * FROM accounts WHERE id = ?', 
      accountId
    );
    console.log('\n2. Account in Database:', {
      found: !!dbAccount,
      details: dbAccount
    });

    // 3. Check transactions in SQLite
    const transactions = await this.db.all(
      `SELECT 
        date, amount, description, type, balance,
        principal_amount, interest_amount, escrow_amount,
        category, card_number
       FROM transactions 
       WHERE account_id = ? 
       ORDER BY date DESC 
       LIMIT 5`, 
      accountId
    );
    console.log('\n3. Recent Transactions:', {
      count: transactions.length,
      samples: transactions
    });

    // 4. Transaction summary
    const summary = await this.db.get(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits,
        SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as total_debits
       FROM transactions 
       WHERE account_id = ?`,
      accountId
    );
    console.log('\n4. Transaction Summary:', summary);

    return {
      accountFound: !!account && !!dbAccount,
      transactionCount: summary.total,
      recentTransactions: transactions,
      summary
    };
  }
}

// Export the class, not an instance
module.exports = TransactionManager; 