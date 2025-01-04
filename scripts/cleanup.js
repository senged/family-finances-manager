const path = require('path');
const { cleanupData } = require('../src/backend/utils/cleanup');

// Get data path from environment or use default
const dataPath = process.env.FFM_DATA_PATH || path.join(process.env.HOME, 'Documents/Financials/Spending/Family Finances Data/test1');

console.log('Cleanup options:', {
  keepAccounts: process.env.KEEP_ACCOUNTS !== 'false',
  dataPath
});

cleanupData(dataPath, {
  keepAccounts: process.env.KEEP_ACCOUNTS !== 'false'
})
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }); 