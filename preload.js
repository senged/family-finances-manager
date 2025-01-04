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
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  showFileDialog: (options) => ipcRenderer.invoke('show-file-dialog', options),
  importTransactions: (data) => ipcRenderer.invoke('import-transactions', data),
  
  // Use the prepared array
  processors: processorsArray,
  
  // Expose account types
  accountTypes: ACCOUNT_TYPES
});