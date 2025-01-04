const fs = require('fs').promises;
const path = require('path');
const { TRANSACTION_PROCESSORS } = require('./processors/transactionProcessors');
const { initializeDatabase } = require('./database/initializeDatabase');

class TransactionManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.db = null;
  }

  async initialize() {
    if (!this.db) {
      this.db = await initializeDatabase(this.dataManager.getDataPath());
    }
  }

  // ... rest of the TransactionManager methods ...
}

// Export the class, not an instance
module.exports = TransactionManager; 