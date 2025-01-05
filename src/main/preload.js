const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script is running');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    // Account functions
    getAccounts: async () => {
      try {
        return await ipcRenderer.invoke('get-accounts');
      } catch (error) {
        console.error('Error in getAccounts:', error);
        throw error;
      }
    },

    // Transaction functions
    getTransactions: async (filters) => {
      try {
        return await ipcRenderer.invoke('get-transactions', filters);
      } catch (error) {
        console.error('Error in getTransactions:', error);
        throw error;
      }
    },
    
    // Partner management functions
    getPartners: async () => {
      try {
        console.log('Renderer: Calling getPartners');
        const result = await ipcRenderer.invoke('get-partners');
        console.log('Renderer: getPartners result:', result);
        return result;
      } catch (error) {
        console.error('Error in getPartners:', error);
        throw error;
      }
    },
    
    createPartner: async (partnerData) => {
      try {
        return await ipcRenderer.invoke('create-partner', partnerData);
      } catch (error) {
        console.error('Error in createPartner:', error);
        throw error;
      }
    },
    
    assignTransactionPartner: async (data) => {
      try {
        return await ipcRenderer.invoke('assign-transaction-partner', data);
      } catch (error) {
        console.error('Error in assignTransactionPartner:', error);
        throw error;
      }
    },
    
    removeTransactionPartner: async (transactionId, partnerId) => {
      try {
        return await ipcRenderer.invoke('remove-transaction-partner', { transactionId, partnerId });
      } catch (error) {
        console.error('Error in removeTransactionPartner:', error);
        throw error;
      }
    }
  }
); 