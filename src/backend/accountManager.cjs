// src/backend/accountManager.js
const fs = require('fs').promises;
const path = require('path');

// Define account types and transaction processing types
const ACCOUNT_TYPES = {
  CHECKING: 'checking',
  SAVINGS: 'savings',
  CREDIT: 'credit',
  MORTGAGE: 'mortgage',
  INVESTMENT: 'investment'
};

// Processor configurations for different financial institutions
const TRANSACTION_PROCESSORS = {
  CHASE: {
    id: 'chase',
    name: 'Chase Bank',
    description: 'Processes Chase bank CSV exports',
    dateColumn: 'Transaction Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    skipRows: 1
  },
  BANK_OF_AMERICA: {
    id: 'bofa',
    name: 'Bank of America',
    description: 'Processes Bank of America CSV exports',
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Payee',
    skipRows: 0
  },
  FIDELITY: {
    id: 'fidelity',
    name: 'Fidelity',
    description: 'Processes Fidelity investment CSV exports',
    dateColumn: 'Date',
    amountColumn: 'Amount',
    descriptionColumn: 'Description',
    skipRows: 1
  },
  CUSTOM: {
    id: 'custom',
    name: 'Custom Format',
    description: 'User-defined CSV format',
    configurable: true
  }
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
    this.accounts = new Map();
    this.accountsFile = path.join(dataPath, 'accounts.json');
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
      await this.loadAccounts();
    } catch (error) {
      console.error('Error initializing AccountManager:', error);
      throw error;
    }
  }

  async loadAccounts() {
    try {
      const data = await fs.readFile(this.accountsFile, 'utf8');
      const accounts = JSON.parse(data);
      this.accounts = new Map(accounts.map(acc => [acc.id, new Account(
        acc.id,
        acc.name,
        acc.type,
        acc.processorType,
        acc.processorConfig
      )]));
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start with empty accounts
        await this.saveAccounts();
      } else {
        throw error;
      }
    }
  }

  async saveAccounts() {
    const accountsArray = Array.from(this.accounts.values()).map(acc => acc.toJSON());
    await fs.writeFile(this.accountsFile, JSON.stringify(accountsArray, null, 2));
  }

  async createAccount(name, type, processorType, processorConfig = {}) {
    if (!ACCOUNT_TYPES[type.toUpperCase()]) {
      throw new Error(`Invalid account type: ${type}`);
    }
    if (!TRANSACTION_PROCESSORS[processorType]) {
      throw new Error(`Invalid processor type: ${processorType}`);
    }

    const id = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const account = new Account(id, name, type, processorType, processorConfig);
    
    this.accounts.set(id, account);
    await this.saveAccounts();
    return account;
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