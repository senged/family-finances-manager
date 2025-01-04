const fs = require('fs').promises;
const path = require('path');

let store;
let storeInitialized;

// Initialize store
async function initStore() {
    if (!storeInitialized) {
        const Store = (await import('electron-store')).default;
        store = new Store();
        storeInitialized = true;
    }
    return store;
}

class DataManager {
  constructor(ffmPath) {
    this.ffmPath = ffmPath;
    this.manifest = null;
    this.accountManager = null;
  }

  async initialize(manifestPath) {
    this.manifestPath = manifestPath;
    try {
      const data = await fs.readFile(manifestPath, 'utf8');
      this.manifest = JSON.parse(data);

      // Initialize AccountManager
      const AccountManager = require('./accountManager').AccountManager;
      this.accountManager = new AccountManager(this.getDataPath());
      await this.accountManager.initialize();
    } catch (error) {
      throw new Error(`Failed to initialize data manager: ${error.message}`);
    }
  }

  // Add this method to get the data directory path
  getDataPath() {
    if (!this.manifestPath) {
      throw new Error('DataManager not initialized');
    }
    // Return the directory containing the manifest file
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

    try {
      await fs.writeFile(filePath, JSON.stringify(manifest, null, 2));
    } catch (error) {
      throw new Error(`Failed to create manifest: ${error.message}`);
    }
  }

  async addAccount(accountData) {
    if (!this.manifest) {
      throw new Error('No manifest loaded');
    }

    // Create account through AccountManager to ensure proper directory structure
    const account = await this.accountManager.createAccount(
      accountData.name,
      accountData.type,
      accountData.processorType,
      accountData.processorConfig || {}
    );

    // Add account to manifest
    this.manifest.accounts.push({
      id: account.id,
      name: account.name,
      type: account.type,
      processorType: account.processorType,
      processorId: account.processorType,  // For compatibility with processors
      created: new Date().toISOString()
    });

    try {
      await fs.writeFile(
        this.manifestPath,
        JSON.stringify(this.manifest, null, 2)
      );
      return { success: true, id: account.id };  // Return success object
    } catch (error) {
      // Cleanup on error
      try {
        const { accountDir } = this.accountManager.getAccountPaths(account.id);
        await fs.rm(accountDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Error during cleanup:', cleanupError);
      }
      throw new Error(`Failed to save account: ${error.message}`);
    }
  }

  getAccountPaths(accountId) {
    return this.accountManager.getAccountPaths(accountId);
  }
}

module.exports = DataManager; 