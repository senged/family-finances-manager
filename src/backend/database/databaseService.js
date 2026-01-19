const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs').promises;

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = null;
  }

  async initialize(manifestPath) {
    if (this.db) {
      return this.db;
    }

    const dataPath = path.dirname(manifestPath);
    const dbDir = path.join(dataPath, 'db');
    await fs.mkdir(dbDir, { recursive: true });
    
    this.dbPath = path.join(dbDir, 'central.db');
    
    this.db = await open({
      filename: this.dbPath,
      driver: sqlite3.Database,
      mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    });

    await this.db.exec(`
      PRAGMA foreign_keys = ON;
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);

    await this.runMigrations();
    
    return this.db;
  }

  async runMigrations() {
    // Initial schema
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        processor_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

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

      CREATE TABLE IF NOT EXISTS transactions (
        global_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        partner_id TEXT REFERENCES partners(id),
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

      CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON transactions(account_id, date);
      CREATE INDEX IF NOT EXISTS idx_transactions_partner ON transactions(partner_id);
      CREATE INDEX IF NOT EXISTS idx_partners_type ON partners(type);
      CREATE INDEX IF NOT EXISTS idx_partners_name ON partners(name);

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
        p.is_internal as partner_is_internal,
        t.balance,
        t.category,
        t.card_number
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN partners p ON t.partner_id = p.id;
    `);
  }

  async getDb() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

module.exports = new DatabaseService();
