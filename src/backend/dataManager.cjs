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
    this.manifest = null;
    this.manifestPath = null;
  }

  createDefaultManifest(name) {
    return {
      name: name,
      version: '1.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      accounts: []
    };
  }

  async initialize(manifestPath) {
    store = await initStore();
    
    if (!manifestPath) {
      throw new Error('MANIFEST_PATH_NOT_SET');
    }

    this.manifestPath = manifestPath;
    const dataDir = path.dirname(manifestPath);

    try {
      await this.ensureDirectoryStructure(dataDir);
      await this.loadManifest();
    } catch (error) {
      console.error('Error initializing data manager:', error);
      throw error;
    }
  }

  async ensureDirectoryStructure(dataDir) {
    const dirs = [
      'accounts'  // Only need accounts directory now
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(dataDir, dir), { recursive: true });
    }
  }

  async loadManifest() {
    try {
      const data = await fs.readFile(this.manifestPath, 'utf8');
      this.manifest = JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('MANIFEST_NOT_FOUND');
      }
      throw error;
    }
  }

  async saveManifest() {
    this.manifest.lastUpdated = new Date().toISOString();
    await fs.writeFile(
      this.manifestPath,
      JSON.stringify(this.manifest, null, 2)
    );
  }

  async createNewManifest(filePath, name) {
    this.manifestPath = filePath;
    this.manifest = this.createDefaultManifest(name);
    await this.saveManifest();
    return this.manifest;
  }

  async addAccount(account) {
    const dataDir = path.dirname(this.manifestPath);
    const uid = `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const accountDir = path.join(dataDir, 'accounts', uid);
    
    await fs.mkdir(accountDir, { recursive: true });

    this.manifest.accounts.push({
      id: uid,
      name: account.name,
      type: account.type,
      created: new Date().toISOString()
    });

    await this.saveManifest();
    return uid;
  }

  getManifest() {
    return this.manifest;
  }
}

module.exports = DataManager; 