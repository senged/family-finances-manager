const fs = require('fs').promises;
const path = require('path');
const dbService = require('./database/databaseService');
const PartnerManager = require('./partnerManager');
const { AccountManager } = require('./accountManager');

class DataManager {
  constructor() {
    this.manifestPath = null;
    this.manifest = null;
    this.accountManager = null;
    this.partnerManager = null;
    this.db = null;
  }

  async initialize(manifestPath) {
    this.manifestPath = manifestPath;
    try {
      console.log('Initializing DataManager...');
      const data = await fs.readFile(manifestPath, 'utf8');
      this.manifest = JSON.parse(data);

      // Initialize central database
      this.db = await dbService.initialize(manifestPath);

      // Initialize Managers
      this.accountManager = new AccountManager(this);
      await this.accountManager.initialize();

      this.partnerManager = new PartnerManager(this);
      await this.partnerManager.initialize();

      // Sync accounts from manifest to DB
      await this.syncAccountsToDb();

      // Sync internal partners
      await this.partnerManager.syncInternalAccountPartners();

      console.log('DataManager initialization complete.');
    } catch (error) {
      console.error('Failed to initialize data manager:', error);
      throw new Error(`Failed to initialize data manager: ${error.message}`);
    }
  }

  async syncAccountsToDb() {
    if (!this.manifest || !this.db) return;

    await this.db.run('BEGIN TRANSACTION');
    try {
      for (const account of this.manifest.accounts) {
        await this.db.run(`
          INSERT OR REPLACE INTO accounts (id, name, type, processor_id, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [account.id, account.name, account.type, account.processorType]);
      }
      await this.db.run('COMMIT');
    } catch (error) {
      await this.db.run('ROLLBACK');
      throw error;
    }
  }

  getDataPath() {
    if (!this.manifestPath) {
      throw new Error('DataManager not initialized');
    }
    return path.dirname(this.manifestPath);
  }

  getManifest() {
    return this.manifest;
  }

  async createNewManifest(filePath, name) {
    const manifest = {
      name: name,
      created: new Date().toISOString(),
      accounts: []
    };
    await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));
  }

  async addAccount(accountData) {
    if (!this.manifest) throw new Error('No manifest loaded');

    const account = await this.accountManager.createAccount(
      accountData.name,
      accountData.type,
      accountData.processorType,
      accountData.processorConfig || {}
    );

    const manifestAccount = {
      id: account.id,
      name: account.name,
      type: account.type,
      processorType: account.processorType,
      processorId: account.processorType,
      created: new Date().toISOString()
    };

    this.manifest.accounts.push(manifestAccount);
    await this.saveManifest();

    // Sync to DB immediately
    await this.db.run(`
      INSERT OR REPLACE INTO accounts (id, name, type, processor_id, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [account.id, account.name, account.type, account.processorType]);

    return { success: true, id: account.id };
  }

  async reloadManifest() {
    if (!this.manifestPath) return;
    const data = await fs.readFile(this.manifestPath, 'utf8');
    this.manifest = JSON.parse(data);
  }

  async saveManifest() {
    if (!this.manifestPath || !this.manifest) return;
    await fs.writeFile(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }
}

module.exports = DataManager;
