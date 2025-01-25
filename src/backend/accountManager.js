// src/backend/accountManager.js
const { TRANSACTION_PROCESSORS } = require('./processors/transactionProcessors');

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
    this.imports = [];
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      processorType: this.processorType,
      processorConfig: this.processorConfig,
      created: this.created,
      imports: this.imports
    };
  }
}

class AccountManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  async initialize() {
    return;
  }

  async createAccount(name, type, processorType, processorConfig = {}) {
    if (!ACCOUNT_TYPES[type.toUpperCase()]) {
      throw new Error(`Invalid account type: ${type}`);
    }
    if (!TRANSACTION_PROCESSORS[processorType]) {
      throw new Error(`Invalid processor type: ${processorType}`);
    }

    const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const account = new Account(id, name, type, processorType, processorConfig);

    // Create an internal partner record for this account
    await this.dataManager.partnerManager.createPartner({
      type: 'ACCOUNT',
      name: name,
      isInternal: true,
      aliases: [],
      categories: [],
      metadata: {
        accountId: id,
        accountType: type
      }
    });

    return account;
  }

  getAccountTypes() {
    return ACCOUNT_TYPES;
  }
}

module.exports = {
  AccountManager,
  ACCOUNT_TYPES
};