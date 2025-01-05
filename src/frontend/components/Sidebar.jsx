// src/frontend/components/Sidebar.jsx
import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  IconButton,
  Box,
  Typography,
  Stack,
  Button,
  Divider
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  AccountBalance as AccountIcon,
  CloudUpload as ImportIcon,
  Add as AddIcon,
  DeleteSweep as CleanupIcon
} from '@mui/icons-material';
import { AccountManager } from './AccountManager.jsx';
import ImportTransactionsDialog from './ImportTransactionsDialog';
import AddAccountDialog from './AddAccountDialog';

function Sidebar({ accounts, onAccountsChange }) {
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const handleImport = (account) => {
    setSelectedAccount(account);
    setImportDialogOpen(true);
  };

  const handleAddAccount = async (accountData) => {
    try {
      const result = await window.electron.addAccount({
        ...accountData,
        processorId: accountData.processorType
      });
      
      if (result.success) {
        onAccountsChange();
      }
    } catch (error) {
      console.error('Error adding account:', error);
    }
  };

  const handleCleanup = async (keepAccounts = false) => {
    if (window.confirm(`Are you sure you want to ${keepAccounts ? 'clear all transaction data' : 'remove all accounts and data'}?`)) {
      try {
        await window.electron.cleanupData({ keepAccounts });
        await onAccountsChange();
        if (!keepAccounts) {
          setAccountsOpen(false);
        }
      } catch (error) {
        console.error('Cleanup failed:', error);
        alert('Failed to cleanup data');
      }
    }
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%'
    }}>
      <List sx={{ flexGrow: 1 }}>
        <ListItem
          secondaryAction={
            <IconButton onClick={() => setIsAddDialogOpen(true)}>
              <AddIcon />
            </IconButton>
          }
        >
          <ListItemButton onClick={() => setAccountsOpen(!accountsOpen)}>
            <ListItemIcon>
              <AccountIcon />
            </ListItemIcon>
            <ListItemText primary="Accounts" />
            {accountsOpen ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
        </ListItem>

        <Collapse in={accountsOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {accounts.map((account) => (
              <ListItem 
                key={account.id} 
                sx={{ pl: 4 }}
                secondaryAction={
                  <IconButton 
                    onClick={() => handleImport(account)}
                    size="small"
                  >
                    <ImportIcon />
                  </IconButton>
                }
              >
                <Stack spacing={0.5} sx={{ py: 1 }}>
                  <Typography variant="body1">
                    {account.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {window.electron.processors.find(p => p.id === account.processorId)?.name || account.processorId}
                  </Typography>
                </Stack>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </List>

      {/* Bottom section with cleanup controls */}
      <Box sx={{ p: 2 }}>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            startIcon={<CleanupIcon />}
            onClick={() => handleCleanup(false)}
            fullWidth
          >
            Delete All Data
          </Button>
        </Stack>
      </Box>

      <AddAccountDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAddAccount}
        existingAccounts={accounts}
        accountTypes={window.electron.accountTypes}
        processors={window.electron.processors}
      />

      <ImportTransactionsDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        account={selectedAccount}
      />
    </Box>
  );
}

export default Sidebar;