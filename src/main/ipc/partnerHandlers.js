const { ipcMain } = require('electron');

module.exports = function setupPartnerHandlers(partnerManager) {
  console.log('Setting up partner handlers');

  ipcMain.handle('get-partners', async () => {
    console.log('get-partners handler called');
    try {
      const result = await partnerManager.listPartners();
      console.log('get-partners result:', result);
      return result;
    } catch (error) {
      console.error('Error in get-partners handler:', error);
      throw error;
    }
  });

  ipcMain.handle('create-partner', async (event, partnerData) => {
    console.log('create-partner handler called with data:', partnerData);
    try {
      return await partnerManager.createPartner(partnerData);
    } catch (error) {
      console.error('Error in create-partner handler:', error);
      throw error;
    }
  });

  ipcMain.handle('assign-transaction-partner', async (event, { transactionId, partnerId, role }) => {
    console.log('assign-transaction-partner handler called:', { transactionId, partnerId, role });
    try {
      return await partnerManager.assignPartnerToTransaction(transactionId, partnerId, role);
    } catch (error) {
      console.error('Error in assign-transaction-partner handler:', error);
      throw error;
    }
  });

  ipcMain.handle('remove-transaction-partner', async (event, { transactionId, partnerId }) => {
    console.log('remove-transaction-partner handler called:', { transactionId, partnerId });
    try {
      return await partnerManager.removePartnerFromTransaction(transactionId, partnerId);
    } catch (error) {
      console.error('Error in remove-transaction-partner handler:', error);
      throw error;
    }
  });

  ipcMain.handle('refresh-partner-summary', async (event, partnerId) => {
    console.log('refresh-partner-summary handler called:', partnerId);
    try {
      return await partnerManager.refreshPartnerSummary(partnerId);
    } catch (error) {
      console.error('Error in refresh-partner-summary handler:', error);
      throw error;
    }
  });

  ipcMain.handle('refresh-all-partner-summaries', async () => {
    console.log('refresh-all-partner-summaries handler called');
    try {
      return await partnerManager.refreshAllPartnerSummaries();
    } catch (error) {
      console.error('Error in refresh-all-partner-summaries handler:', error);
      throw error;
    }
  });

  console.log('Partner handlers setup complete');
}; 