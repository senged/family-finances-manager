const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

async function initializeDatabase(dataPath) {
  // Ensure database directory exists
  const dbDir = path.join(dataPath, 'db');
  await fs.mkdir(dbDir, { recursive: true });

  const dbPath = path.join(dbDir, 'central.db');
  
  // Open database with promise interface
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
    // Additional options for better performance
    mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    // Enable verbose logging in development
    verbose: process.env.NODE_ENV === 'development'
  });

  // Enable foreign keys and WAL mode for better performance
  await db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
  `);

  // Create tables
  await db.exec(`
    -- Core transaction table
    CREATE TABLE IF NOT EXISTS transactions (
      global_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      date TEXT NOT NULL,
      posted_date TEXT,
      amount REAL NOT NULL,
      description TEXT,
      category TEXT,
      type TEXT NOT NULL,
      balance REAL,
      
      -- For mortgage transactions
      principal_amount REAL,
      interest_amount REAL,
      escrow_amount REAL,
      
      -- For credit card transactions
      card_number TEXT,
      merchant_category TEXT,
      
      -- Metadata
      raw_data TEXT,
      processing_metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );

    -- Import tracking
    CREATE TABLE IF NOT EXISTS import_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      backup_path TEXT NOT NULL,
      import_date DATETIME NOT NULL,
      transaction_count INTEGER NOT NULL,
      processor_version TEXT NOT NULL,
      status TEXT NOT NULL,
      
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_account_date 
      ON transactions(account_id, date);
    CREATE INDEX IF NOT EXISTS idx_category 
      ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_type 
      ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_date 
      ON transactions(date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_file_hash 
      ON import_records(account_id, file_hash);
  `);

  return db;
}

// Helper to safely close database
async function closeDatabase(db) {
  if (db) {
    await db.close();
  }
}

module.exports = { 
  initializeDatabase,
  closeDatabase
}; 