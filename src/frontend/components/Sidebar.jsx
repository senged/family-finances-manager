// src/frontend/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
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
  Divider,
  Tooltip
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
import format from 'date-fns/format';

function Sidebar({ accounts, onAccountsChange, isCollapsed }) {
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [accountDateRanges, setAccountDateRanges] = useState({});

  useEffect(() => {
    loadAccountDateRanges();
  }, [accounts]);

  const loadAccountDateRanges = async () => {
    const ranges = {};
    for (const account of accounts) {
      try {
        const result = await window.electron.getTransactions({
          accountId: [account.id]
        });
        if (result.length > 0) {
          const dates = result.map(tx => new Date(tx.date));
          ranges[account.id] = {
            earliest: new Date(Math.min(...dates)),
            latest: new Date(Math.max(...dates))
          };
        }
      } catch (error) {
        console.error(`Error loading date range for account ${account.id}:`, error);
      }
    }
    setAccountDateRanges(ranges);
  };

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

  const formatDateRange = (range) => {
    if (!range) return 'No transactions';
    return `${format(range.earliest, 'MMM d, yyyy')} - ${format(range.latest, 'MMM d, yyyy')}`;
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
            !isCollapsed && (
              <IconButton onClick={() => setIsAddDialogOpen(true)}>
                <AddIcon />
              </IconButton>
            )
          }
        >
          <ListItemButton 
            onClick={() => setAccountsOpen(!accountsOpen)}
            sx={isCollapsed ? { minWidth: 0, px: 2.5 } : {}}
          >
            <ListItemIcon sx={isCollapsed ? { minWidth: 0, mr: 'auto' } : {}}>
              <AccountIcon />
            </ListItemIcon>
            {!isCollapsed && (
              <>
                <ListItemText primary="Accounts" />
                {accountsOpen ? <ExpandLess /> : <ExpandMore />}
              </>
            )}
          </ListItemButton>
        </ListItem>

        <Collapse in={accountsOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {accounts.map((account) => (
              <ListItem 
                key={account.id} 
                sx={{ pl: isCollapsed ? 2 : 4 }}
                secondaryAction={
                  !isCollapsed && (
                    <IconButton 
                      onClick={() => handleImport(account)}
                      size="small"
                    >
                      <ImportIcon />
                    </IconButton>
                  )
                }
              >
                {isCollapsed ? (
                  <Tooltip 
                    title={
                      <Box>
                        <Typography variant="body2">{account.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {window.electron.processors.find(p => p.id === account.processorId)?.name}
                        </Typography>
                        <Typography variant="caption" display="block" color="text.secondary">
                          {formatDateRange(accountDateRanges[account.id])}
                        </Typography>
                      </Box>
                    }
                    placement="right"
                  >
                    <IconButton size="small">
                      <AccountIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Stack spacing={0.5} sx={{ py: 1, width: '100%' }}>
                    <Typography variant="body1">
                      {account.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {window.electron.processors.find(p => p.id === account.processorId)?.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateRange(accountDateRanges[account.id])}
                    </Typography>
                  </Stack>
                )}
              </ListItem>
            ))}
          </List>
        </Collapse>
      </List>

      {!isCollapsed && (
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
      )}

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