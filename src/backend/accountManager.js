// src/backend/accountManager.js
const fs = require('fs').promises;
const path = require('path');
const { TRANSACTION_PROCESSORS } = require('./processors/transactionProcessors');

// Define account types and transaction processing types
const ACCOUNT_TYPES = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  CREDIT: 'credit',
  MORTGAGE: 'mortgage',
  INVESTMENT: 'investment'
};

class Account {
  constructor(id, name, type, processorType, processorConfig = {}) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.processorType = processorType;
    this.processorConfig = processorConfig;
    this.created = new Date();
    this.lastUpdated = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      processorType: this.processorType,
      processorConfig: this.processorConfig,
      created: this.created,
      lastUpdated: this.lastUpdated
    };
  }
}

class AccountManager {
  constructor(dataPath) {
    this.dataPath = dataPath;
    this.accountsDir = path.join(dataPath, 'accounts');
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.mkdir(this.accountsDir, { recursive: true });
    } catch (error) {
      console.error('Error initializing AccountManager:', error);
      throw error;
    }
  }

  async createAccount(name, type, processorType, processorConfig = {}) {
    if (!ACCOUNT_TYPES[type.toUpperCase()]) {
      throw new Error(`Invalid account type: ${type}`);
    }
    if (!TRANSACTION_PROCESSORS[processorType]) {
      throw new Error(`Invalid processor type: ${processorType}`);
    }

    // Generate unique ID with acc_ prefix
    const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    // Create account directory structure
    const baseAccountsDir = path.join(this.dataPath, 'accounts');
    const accountDir = path.join(this.accountsDir, id);
    const rawDir = path.join(accountDir, 'raw');
    const transactionsFile = path.join(accountDir, `transactions_${id}.csv`);
    
    try {
      // Ensure base accounts directory exists first
      await fs.mkdir(baseAccountsDir, { recursive: true });
      
      // Create account-specific directories
      await fs.mkdir(accountDir);
      await fs.mkdir(rawDir);

      // Create transactions CSV with headers
      const headers = [
        'date',
        'posted_date',
        'amount',
        'description',
        'type',
        'balance',
        'principal_amount',
        'interest_amount',
        'escrow_amount',
        'category',
        'card_number',
        'raw_data',
        'import_timestamp',
        'source_file'
      ].join(',');
      await fs.writeFile(transactionsFile, headers + '\n');

      const account = new Account(id, name, type, processorType, processorConfig);
      return account;
    } catch (error) {
      // Cleanup on error
      try {
        await fs.rm(accountDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      console.error('Error creating account directories:', error);
      throw error;
    }
  }

  // Helper method to get account directory paths
  getAccountPaths(accountId) {
    const accountDir = path.join(this.accountsDir, accountId);
    return {
      accountDir,
      rawDir: path.join(accountDir, 'raw'),
      transactionsFile: path.join(accountDir, `transactions_${accountId}.csv`)
    };
  }

  async updateAccount(id, updates) {
    const account = this.accounts.get(id);
    if (!account) {
      throw new Error(`Account not found: ${id}`);
    }

    Object.assign(account, updates);
    account.lastUpdated = new Date();
    
    await this.saveAccounts();
    return account;
  }

  async deleteAccount(id) {
    if (!this.accounts.has(id)) {
      throw new Error(`Account not found: ${id}`);
    }

    this.accounts.delete(id);
    await this.saveAccounts();
  }

  getProcessorTypes() {
    return TRANSACTION_PROCESSORS;
  }

  getAccountTypes() {
    return ACCOUNT_TYPES;
  }
}

module.exports = {
  AccountManager,
  ACCOUNT_TYPES
};