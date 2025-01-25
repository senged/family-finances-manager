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
    
    listPartners: async () => {
      try {
        console.log('Renderer: Calling listPartners');
        const result = await ipcRenderer.invoke('get-partners');
        console.log('Renderer: listPartners result:', result);
        return result;
      } catch (error) {
        console.error('Error in listPartners:', error);
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
    
    assignPartnerToTransaction: async (transactionId, partnerId, role) => {
      try {
        return await ipcRenderer.invoke('assign-transaction-partner', { transactionId, partnerId, role });
      } catch (error) {
        console.error('Error in assignPartnerToTransaction:', error);
        throw error;
      }
    },
    
    removePartnerFromTransaction: async (transactionId, partnerId) => {
      try {
        return await ipcRenderer.invoke('remove-transaction-partner', { transactionId, partnerId });
      } catch (error) {
        console.error('Error in removePartnerFromTransaction:', error);
        throw error;
      }
    },

    refreshPartnerSummary: async (partnerId) => {
      try {
        return await ipcRenderer.invoke('refresh-partner-summary', partnerId);
      } catch (error) {
        console.error('Error in refreshPartnerSummary:', error);
        throw error;
      }
    },

    refreshAllPartnerSummaries: async () => {
      try {
        return await ipcRenderer.invoke('refresh-all-partner-summaries');
      } catch (error) {
        console.error('Error in refreshAllPartnerSummaries:', error);
        throw error;
      }
    }
  }
); 