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
  constructor() {
    this.manifestPath = null;
    this.manifest = null;
  }

  async initialize(manifestPath) {
    this.manifestPath = manifestPath;
    try {
      const data = await fs.readFile(manifestPath, 'utf8');
      this.manifest = JSON.parse(data);
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

    const uid = generateUid();
    const account = {
      id: uid,
      ...accountData,
      created: new Date().toISOString()
    };

    this.manifest.accounts.push(account);

    try {
      await fs.writeFile(
        this.manifestPath,
        JSON.stringify(this.manifest, null, 2)
      );
      return uid;
    } catch (error) {
      throw new Error(`Failed to save account: ${error.message}`);
    }
  }
}

function generateUid() {
  return Math.random().toString(36).substr(2, 9);
}

module.exports = DataManager; 