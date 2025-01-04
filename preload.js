const { contextBridge, ipcRenderer } = require('electron');
const { ACCOUNT_TYPES } = require('./src/backend/accountManager');
const { TRANSACTION_PROCESSORS } = require('./src/backend/processors/transactionProcessors');

contextBridge.exposeInMainWorld('electron', {
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  accountTypes: ACCOUNT_TYPES,
  processors: TRANSACTION_PROCESSORS.map(({ id, name, description }) => ({ id, name, description }))
});