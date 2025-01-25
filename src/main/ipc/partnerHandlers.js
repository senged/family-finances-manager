const { ipcMain } = require('electron');

module.exports = function setupPartnerHandlers(partnerManager) {
  console.log('Setting up partner handlers');

  ipcMain.handle('listPartners', async () => {
    console.log('listPartners handler called');
    try {
      const result = await partnerManager.listPartners();
      console.log('listPartners result:', result);
      return result;
    } catch (error) {
      console.error('Error in listPartners handler:', error);
      throw error;
    }
  });

  ipcMain.handle('createPartner', async (event, partnerData) => {
    console.log('createPartner handler called with data:', partnerData);
    try {
      return await partnerManager.createPartner(partnerData);
    } catch (error) {
      console.error('Error in createPartner handler:', error);
      throw error;
    }
  });

  ipcMain.handle('assignPartnerToTransaction', async (event, transactionId, partnerId, role) => {
    console.log('assignPartnerToTransaction handler called:', { transactionId, partnerId, role });
    try {
      return await partnerManager.assignPartnerToTransaction(transactionId, partnerId, role);
    } catch (error) {
      console.error('Error in assignPartnerToTransaction handler:', error);
      throw error;
    }
  });

  ipcMain.handle('removePartnerFromTransaction', async (event, transactionId, partnerId) => {
    console.log('removePartnerFromTransaction handler called:', { transactionId, partnerId });
    try {
      return await partnerManager.removePartnerFromTransaction(transactionId, partnerId);
    } catch (error) {
      console.error('Error in removePartnerFromTransaction handler:', error);
      throw error;
    }
  });

  ipcMain.handle('refreshPartnerSummary', async (event, partnerId) => {
    console.log('refreshPartnerSummary handler called:', partnerId);
    try {
      return await partnerManager.refreshPartnerSummary(partnerId);
    } catch (error) {
      console.error('Error in refreshPartnerSummary handler:', error);
      throw error;
    }
  });

  ipcMain.handle('refreshAllPartnerSummaries', async () => {
    console.log('refreshAllPartnerSummaries handler called');
    try {
      return await partnerManager.refreshAllPartnerSummaries();
    } catch (error) {
      console.error('Error in refreshAllPartnerSummaries handler:', error);
      throw error;
    }
  });

  console.log('Partner handlers setup complete');
}; 