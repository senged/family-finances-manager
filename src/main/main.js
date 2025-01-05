const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const { setupTransactionHandlers } = require('./ipc/transactionHandlers');
const { setupPartnerHandlers } = require('./ipc/partnerHandlers');
const { initializeDatabase } = require('../backend/database/initializeDatabase');
const TransactionManager = require('../backend/transactionManager');
const PartnerManager = require('../backend/partnerManager');
const DataManager = require('../backend/dataManager');

let mainWindow;
let db;
let dataManager;
let transactionManager;
let partnerManager;

async function createWindow() {
  console.log('Creating main window');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  if (isDev) {
    console.log('Running in development mode');
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    console.log('Running in production mode');
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window finished loading');
  });
}

async function initialize() {
  console.log('Starting initialization');
  try {
    console.log('Creating DataManager');
    dataManager = new DataManager();

    console.log('Initializing database');
    db = await initializeDatabase(dataManager.getDataPath());

    console.log('Creating TransactionManager');
    transactionManager = new TransactionManager(dataManager);

    console.log('Creating PartnerManager');
    partnerManager = new PartnerManager(db);

    console.log('Initializing TransactionManager');
    await transactionManager.initialize();
    
    console.log('Setting up transaction handlers');
    setupTransactionHandlers(transactionManager);

    console.log('Setting up partner handlers');
    setupPartnerHandlers(partnerManager);

    console.log('Initialization complete');
  } catch (error) {
    console.error('Failed to initialize:', error);
    app.quit();
  }
}

app.whenReady().then(async () => {
  console.log('App is ready');
  await initialize();
  await createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', async function () {
  if (process.platform !== 'darwin') {
    if (db) {
      await db.close();
    }
    app.quit();
  }
});

// Handle app quit
app.on('before-quit', async (event) => {
  if (db) {
    event.preventDefault();
    await db.close();
    app.quit();
  }
}); 