const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const DataManager = require('./src/backend/dataManager.cjs');
const TransactionManager = require('./src/backend/transactionManager.cjs');
const { cleanupData } = require('./src/backend/utils/cleanup');

// Create data manager instance
const dataManager = new DataManager();
const transactionManager = new TransactionManager(dataManager);

async function showInitialDialog(mainWindow) {
  const { dialog } = require('electron');

  async function showMainDialog() {
    const dialogOptions = {
      type: 'question',
      buttons: ['Open Existing', 'Create New', 'Cancel'],
      defaultId: 0,
      title: 'Family Finance Manager',
      message: 'Would you like to open an existing file or create a new one?'
    };

    const { response } = await dialog.showMessageBox(mainWindow, dialogOptions);
    return response;
  }

  async function showCreateDialog() {
    const inputDialog = new BrowserWindow({
      width: 400,
      height: 200,
      parent: mainWindow,
      modal: true,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    try {
      return await new Promise((resolve) => {
        inputDialog.loadFile(path.join(__dirname, 'src/frontend/createDialog.html'));

        inputDialog.once('ready-to-show', () => {
          inputDialog.show();
        });

        // Handle IPC messages from the dialog
        ipcMain.once('create-dialog-response', async (event, data) => {
          if (data.type === 'create') {
            const saveResult = await dialog.showSaveDialog(inputDialog, {
              defaultPath: `${data.name}.ffm`,
              filters: [{ name: 'Finance Manager Files', extensions: ['ffm'] }],
              title: 'Choose Location'
            });

            if (!saveResult.canceled && saveResult.filePath) {
              inputDialog.close();
              resolve({
                type: 'new',
                path: saveResult.filePath,
                name: data.name
              });
            }
            // If save was cancelled, keep the create dialog open
          } else {
            inputDialog.close();
            resolve(null);
          }
        });

        inputDialog.on('closed', () => {
          ipcMain.removeAllListeners('create-dialog-response');
          resolve(null);
        });
      });
    } finally {
      if (!inputDialog.isDestroyed()) {
        inputDialog.close();
      }
    }
  }

  while (true) {
    const response = await showMainDialog();

    if (response === 0) { // Open Existing
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Finance Manager Files', extensions: ['ffm'] }],
        title: 'Open Finance Manager File'
      });

      if (result.canceled || !result.filePaths.length) {
        continue; // Go back to main dialog
      }
      return { type: 'open', path: result.filePaths[0] };

    } else if (response === 1) { // Create New
      const result = await showCreateDialog();
      if (result && result.type === 'new') {
        return result; // This will contain path and name
      }
      continue; // Go back to main dialog if create was cancelled

    } else { // Cancel
      throw new Error('OPERATION_CANCELLED');
    }
  }
}

async function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  try {
    const result = await showInitialDialog(mainWindow);

    if (result.type === 'new') {
      await dataManager.createNewManifest(result.path, result.name);
      await dataManager.initialize(result.path);
      await transactionManager.initialize();
    } else {
      await dataManager.initialize(result.path);
      await transactionManager.initialize();
    }

    // In development, connect to Vite dev server
    if (process.env.NODE_ENV === 'development') {
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
    }

  } catch (error) {
    if (error.message === 'OPERATION_CANCELLED') {
      app.quit();
      return;
    }
    console.error('Failed to initialize:', error);
    dialog.showErrorBox('Initialization Error', error.message);
    app.quit();
  }
}

// IPC Handlers for data management
ipcMain.handle('get-accounts', async () => {
  // Always reload manifest to ensure fresh data
  await dataManager.reloadManifest();
  return dataManager.getManifest()?.accounts || [];
});

ipcMain.handle('show-file-dialog', async (event, options) => {
  return dialog.showOpenDialog(options);
});

ipcMain.handle('import-transactions', async (event, data) => {
  try {
    return await transactionManager.importTransactions(data);
  } catch (error) {
    console.error('Error importing transactions:', error);
    throw error;
  }
});

ipcMain.handle('add-account', async (event, accountData) => {
  try {
    const uid = await dataManager.addAccount(accountData);
    return {
      success: true,
      accountId: uid
    };
  } catch (error) {
    console.error('Error adding account:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('cleanup-data', async (event, options) => {
  try {
    await cleanupData(dataManager.getDataPath(), options);
    await dataManager.reloadManifest();
    return { success: true };
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  }
});

ipcMain.handle('get-transactions', async (event, filters) => {
  try {
    return await transactionManager.getTransactions(filters);
  } catch (error) {
    console.error('Error getting transactions:', error);
    throw error;
  }
});

ipcMain.handle('get-summary', async (event, filters) => {
  try {
    return await transactionManager.getSummary(filters);
  } catch (error) {
    console.error('Error getting summary:', error);
    throw error;
  }
});

ipcMain.handle('deduplicate-transactions', async () => {
  try {
    return await transactionManager.deduplicateTransactions();
  } catch (error) {
    console.error('Error deduplicating transactions:', error);
    throw error;
  }
});

// Partner management handlers
ipcMain.handle('listPartners', async () => {
  return dataManager.partnerManager.listPartners();
});

ipcMain.handle('getPartner', async (event, partnerId) => {
  return dataManager.partnerManager.getPartner(partnerId);
});

ipcMain.handle('assignPartnerToTransaction', async (event, transactionId, partnerId) => {
  return dataManager.partnerManager.assignPartnerToTransaction(transactionId, partnerId);
});

ipcMain.handle('removePartnerFromTransaction', async (event, transactionId) => {
  return dataManager.partnerManager.removePartnerFromTransaction(transactionId);
});

ipcMain.handle('refreshAllPartnerSummaries', async () => {
  return dataManager.partnerManager.refreshAllPartnerSummaries();
});

ipcMain.handle('createPartner', async (event, partnerData) => {
  return dataManager.partnerManager.createPartner(partnerData);
});

// Initialize data manager on app ready
app.whenReady().then(async () => {
  try {
    await createWindow();
  } catch (error) {
    console.error('Failed to initialize:', error);
    dialog.showErrorBox('Initialization Error', error.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});