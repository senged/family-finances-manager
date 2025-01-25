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

    console.log('Creating transaction_partners table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS transaction_partners (
        transaction_id TEXT NOT NULL,
        partner_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('source', 'destination')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (transaction_id, partner_id),
        FOREIGN KEY (transaction_id) REFERENCES transactions(global_id),
        FOREIGN KEY (partner_id) REFERENCES partners(id),
        UNIQUE (transaction_id, role)
      );

      CREATE INDEX IF NOT EXISTS idx_transaction_partners_partner 
      ON transaction_partners(partner_id);
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