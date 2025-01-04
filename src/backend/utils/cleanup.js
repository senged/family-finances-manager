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

    // 2. Clean account data
    console.log('\n2. Cleaning account data...');
    try {
      const accountsDir = path.join(dataPath, 'accounts');
      const accountDirs = await fs.readdir(accountsDir);

      if (options.keepAccounts) {
        // Keep accounts but clean their data
        for (const accountDir of accountDirs) {
          const accountPath = path.join(accountsDir, accountDir);
          const rawDir = path.join(accountPath, 'raw');
          const transactionsFile = path.join(accountPath, `transactions_${accountDir}.csv`);

          // Remove raw directory and its contents
          await fs.rm(rawDir, { recursive: true, force: true });
          // Remove transactions file
          await fs.rm(transactionsFile, { force: true });
          // Recreate empty raw directory
          await fs.mkdir(rawDir);

          console.log(`✓ Cleaned data for account: ${accountDir}`);
        }
      } else {
        // Remove entire accounts directory
        await fs.rm(accountsDir, { recursive: true, force: true });
        console.log('✓ Accounts directory removed');
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
    // Find the .ffm file in the directory
    const files = await fs.readdir(dataPath);
    const ffmFile = files.find(file => file.endsWith('.ffm'));
    if (!ffmFile) {
      throw new Error('No .ffm file found in data directory');
    }
    const ffmPath = path.join(dataPath, ffmFile);

    try {
      const manifest = JSON.parse(await fs.readFile(ffmPath, 'utf8'));
      if (!options.keepAccounts) {
        manifest.accounts = [];
      } else {
        // Keep accounts but clear their transaction stats
        manifest.accounts = manifest.accounts.map(account => ({
          ...account,
          lastImport: null,
          transactionCount: 0,
          dateRange: { start: null, end: null }
        }));
      }
      await fs.writeFile(ffmPath, JSON.stringify(manifest, null, 2));
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