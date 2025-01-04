const fs = require('fs').promises;
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function cleanupData(dataPath, options = { keepAccounts: true }) {
  console.log('\n=== Starting Data Cleanup ===\n');

  try {
    // 1. Clean SQLite database
    const dbDir = path.join(dataPath, 'db');
    const dbPath = path.join(dbDir, 'central.db');
    
    console.log('1. Cleaning SQLite database...');
    try {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Begin transaction
      await db.exec('BEGIN TRANSACTION');
      
      try {
        // Always delete transactions
        await db.exec('DELETE FROM transactions;');
        console.log('✓ Transactions deleted');

        if (!options.keepAccounts) {
          await db.exec('DELETE FROM accounts;');
          console.log('✓ Accounts deleted');
        }

        await db.exec('COMMIT');
        await db.exec('VACUUM;');
      } catch (error) {
        await db.exec('ROLLBACK');
        throw error;
      }
      
      await db.close();
      console.log('✓ SQLite database cleaned');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('✓ No SQLite database found (already clean)');
      } else {
        throw error;
      }
    }

    // 2. Clean transaction data in account directories
    console.log('\n2. Cleaning account data...');
    try {
      const accountsDir = path.join(dataPath, 'accounts');
      if (!options.keepAccounts) {
        // Remove entire accounts directory
        await fs.rm(accountsDir, { recursive: true, force: true });
        console.log('✓ Account directories removed');
      } else {
        // Just clean transaction data within account directories
        const accountDirs = await fs.readdir(accountsDir);
        for (const accountDir of accountDirs) {
          const transactionsDir = path.join(accountsDir, accountDir, 'transactions');
          await fs.rm(transactionsDir, { recursive: true, force: true });
        }
        console.log('✓ Transaction data removed from account directories');
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('✓ No account data found (already clean)');
      } else {
        throw error;
      }
    }

    // 3. Update manifest file
    console.log('\n3. Updating manifest file...');
    const manifestPath = path.join(dataPath, 'manifest.json');
    try {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      if (!options.keepAccounts) {
        manifest.accounts = [];
      } else {
        // Clear transaction counts and date ranges but keep accounts
        manifest.accounts = manifest.accounts.map(account => ({
          ...account,
          stats: {
            lastImport: null,
            transactionCount: 0,
            dateRange: { start: null, end: null }
          }
        }));
      }
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('✓ Manifest file updated');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('✓ No manifest file found (already clean)');
      } else {
        throw error;
      }
    }

    console.log('\n=== Cleanup Complete ===');
    if (options.keepAccounts) {
      console.log('All transaction data has been removed while preserving accounts.');
    } else {
      console.log('All data including accounts has been removed.');
    }
    console.log('You can now restart the application.\n');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

module.exports = { cleanupData }; 