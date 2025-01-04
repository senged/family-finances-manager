const { contextBridge, ipcRenderer } = require('electron');
const { ACCOUNT_TYPES } = require('./src/backend/accountManager');

contextBridge.exposeInMainWorld('electron', {
  getAccounts: () => ipcRenderer.invoke('get-accounts'),
  addAccount: (account) => ipcRenderer.invoke('add-account', account),
  accountTypes: ACCOUNT_TYPES || []
});