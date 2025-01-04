import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemText
} from '@mui/material';

function ImportTransactionsDialog({ open, onClose, account }) {
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);

  const handleFileSelect = async () => {
    const result = await window.electron.showFileDialog({
      title: 'Select Transaction Files',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile', 'multiSelections']
    });

    if (!result.canceled) {
      setFiles(result.filePaths);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const importResults = await window.electron.importTransactions({
        accountId: account.id,
        files: files
      });
      setResults(importResults);
    } catch (error) {
      setResults({ error: error.message });
    }
    setImporting(false);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Transactions - {account.name}</DialogTitle>
      <DialogContent>
        {importing ? (
          <>
            <Typography>Importing transactions...</Typography>
            <LinearProgress />
          </>
        ) : results ? (
          <List>
            {results.files.map(file => (
              <ListItem key={file.path}>
                <ListItemText
                  primary={file.name}
                  secondary={file.success ? 
                    `Imported ${file.count} transactions` : 
                    `Error: ${file.error}`}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <>
            <Button onClick={handleFileSelect}>
              Select Files
            </Button>
            <List>
              {files.map(file => (
                <ListItem key={file}>
                  <ListItemText primary={file} />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {!importing && !results && (
          <Button 
            onClick={handleImport}
            disabled={files.length === 0}
            variant="contained"
          >
            Import
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default ImportTransactionsDialog; 