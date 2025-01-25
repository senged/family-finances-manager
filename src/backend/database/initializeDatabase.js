const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

async function initializeDatabase(dataPath) {
  console.log('Initializing database...');
  try {
    // Ensure database directory exists
    const dbDir = path.join(dataPath, 'db');
    await fs.mkdir(dbDir, { recursive: true });
    
    const dbPath = path.join(dbDir, 'central.db');
    console.log('Database path:', dbPath);
    
    // Open database with promise interface
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
      // Additional options for better performance
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
      // Enable verbose logging in development
      verbose: process.env.NODE_ENV === 'development'
    });

    console.log('Database opened, setting PRAGMA statements...');
    // Enable foreign keys and WAL mode for better performance
    await db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);

    console.log('Creating accounts table...');
    // Create tables sequentially to ensure proper dependency order
    await db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        processor_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(id)
      );
    `);

    console.log('Creating partners table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS partners (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        is_internal INTEGER NOT NULL DEFAULT 0,
        aliases TEXT,
        categories TEXT,
        metadata TEXT,
        transaction_count INTEGER DEFAULT 0,
        total_debits REAL DEFAULT 0,
        total_credits REAL DEFAULT 0,
        net_amount REAL DEFAULT 0,
        last_summary_update DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(type);
      CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);
      CREATE INDEX IF NOT EXISTS idx_partners_internal ON partners(is_internal);
    `);

    console.log('Creating transactions table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS transactions (
        global_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        date TEXT NOT NULL,
        posted_date TEXT,
        amount REAL NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        balance REAL,
        principal_amount REAL,
        interest_amount REAL,
        escrow_amount REAL,
        category TEXT,
        card_number TEXT,
        raw_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );

      CREATE INDEX IF NOT EXISTS idx_transactions_account_date 
      ON transactions(account_id, date);

      CREATE INDEX IF NOT EXISTS idx_transactions_type 
      ON transactions(type);

      CREATE INDEX IF NOT EXISTS idx_transactions_category 
      ON transactions(category);
    `);

    // Check if partner_id column exists in transactions table, add if missing
    console.log('Checking for partner_id column in transactions table...');
    const tableInfo = await db.all("PRAGMA table_info(transactions)");
    const hasPartnerIdColumn = tableInfo.some(column => column.name === 'partner_id');
    
    if (!hasPartnerIdColumn) {
      console.log('Adding partner_id column to transactions table...');
      try {
        await db.exec(`
          ALTER TABLE transactions ADD COLUMN partner_id TEXT REFERENCES partners(id);
          CREATE INDEX IF NOT EXISTS idx_transactions_partner ON transactions(partner_id);
        `);
        console.log('partner_id column added successfully');
      } catch (error) {
        console.error('Error adding partner_id column:', error);
        // If the column already exists or there's another issue, log it but continue
      }
    } else {
      console.log('partner_id column already exists');
    }

    // Migrate data from transaction_partners if the table exists
    console.log('Checking for transaction_partners table...');
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='transaction_partners'");
    if (tables.length > 0) {
      console.log('Migrating data from transaction_partners table...');
      await db.exec(`
        UPDATE transactions 
        SET partner_id = (
          SELECT partner_id 
          FROM transaction_partners 
          WHERE transaction_partners.transaction_id = transactions.global_id 
          AND transaction_partners.role = 'destination'
          LIMIT 1
        )
        WHERE partner_id IS NULL;

        DROP TABLE transaction_partners;
      `);
      console.log('Data migration complete');
    }

    console.log('Creating transactions view...');
    await db.exec(`
      DROP VIEW IF EXISTS transactions_view;
      CREATE VIEW transactions_view AS
      SELECT 
        t.global_id,
        t.account_id,
        a.name as account_name,
        t.date,
        t.amount,
        t.description,
        t.type,
        t.partner_id,
        p.name as partner_name,
        p.is_internal as partner_is_internal
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN partners p ON t.partner_id = p.id;
    `);

    console.log('Database initialization complete.');
    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function closeDatabase(db) {
  if (db) {
    await db.close();
  }
}

module.exports = { 
  initializeDatabase,
  closeDatabase
}; 