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

  // Create tables if they don't exist
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

  return db;
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