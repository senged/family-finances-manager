const { contextBridge, ipcRenderer } = require('electron');
const { ACCOUNT_TYPES } = require('./src/backend/accountManager');
const { TRANSACTION_PROCESSORS } = require('./src/backend/processors/transactionProcessors');

// Convert processors to array format for frontend use
const processorsArray = Object.entries(TRANSACTION_PROCESSORS).map(([id, processor]) => ({
  id,
  name: processor.name,
  description: processor.description
}));

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Account and transaction methods
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  showFileDialog: (options) => ipcRenderer.invoke('show-file-dialog', options),
  importTransactions: (data) => ipcRenderer.invoke('import-transactions', data),
  cleanupData: (options) => ipcRenderer.invoke('cleanup-data', options),
  getTransactions: (filters) => ipcRenderer.invoke('get-transactions', filters),
  
  // Partner management methods
  listPartners: () => ipcRenderer.invoke('listPartners'),
  getPartner: (partnerId) => ipcRenderer.invoke('getPartner', partnerId),
  getTransactionPartners: (transactionId) => ipcRenderer.invoke('getTransactionPartners', transactionId),
  createPartner: (partnerData) => ipcRenderer.invoke('createPartner', partnerData),
  
  // Use the prepared array
  processors: processorsArray,
  
  // Expose account types
  accountTypes: ACCOUNT_TYPES
});