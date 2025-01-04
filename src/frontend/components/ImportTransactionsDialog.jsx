import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress
} from '@mui/material';

function ImportTransactionsDialog({ open, onClose, account }) {
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    try {
      setImporting(true);
      setError(null);

      const result = await window.electron.showFileDialog({
        properties: ['openFile'],
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        title: `Import Transactions for ${account?.name}`
      });

      if (!result.canceled && result.filePaths.length > 0) {
        await window.electron.importTransactions({
          accountId: account.id,
          filePath: result.filePaths[0]
        });
        onClose();
      }
    } catch (error) {
      console.error('Import error:', error);
      setError(error.message);
    } finally {
      setImporting(false);
    }
  };

  if (!account) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Import Transactions</DialogTitle>
      <DialogContent>
        <Typography variant="subtitle1" gutterBottom>
          Import transactions for: {account.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Select a CSV file containing transactions for this account.
        </Typography>
        
        {importing && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress />
          </Box>
        )}
        
        {error && (
          <Typography color="error" sx={{ mt: 2 }}>
            Error: {error}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleImport} 
          variant="contained" 
          disabled={importing}
        >
          Select File
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ImportTransactionsDialog; 