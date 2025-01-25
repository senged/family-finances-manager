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
import ImportTransactionsDialog from './ImportTransactionsDialog';
import AddAccountDialog from './AddAccountDialog';
import format from 'date-fns/format';
import { differenceInHours, differenceInDays, differenceInWeeks, differenceInMonths, differenceInYears } from 'date-fns';

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

  const formatDateRange = (range, account) => {
    if (!range) return 'No transactions';
    
    const dateRange = `${format(range.earliest, 'MMM d, yyyy')} - ${format(range.latest, 'MMM d, yyyy')}`;
    
    // Calculate relative time from last import
    if (!account.imports || account.imports.length === 0) {
      return dateRange;
    }

    const lastImport = account.imports
      .filter(imp => imp.dateRange?.end)
      .sort((a, b) => new Date(b.dateRange.end) - new Date(a.dateRange.end))[0];

    if (!lastImport) {
      return dateRange;
    }

    const lastDate = new Date(lastImport.dateRange.end);
    const now = new Date();
    const hours = differenceInHours(now, lastDate);
    const days = differenceInDays(now, lastDate);
    const weeks = differenceInWeeks(now, lastDate);
    const months = differenceInMonths(now, lastDate);
    const years = differenceInYears(now, lastDate);

    let relativeText;
    if (hours < 24) {
      relativeText = hours === 1 ? '1 hour' : `${hours} hours`;
    } else if (days < 7) {
      relativeText = days === 1 ? '1 day' : `${days} days`;
    } else if (weeks < 4) {
      relativeText = weeks === 1 ? '1 week' : `${weeks} weeks`;
    } else if (months < 12) {
      relativeText = months === 1 ? '1 month' : `${months} months`;
    } else {
      relativeText = years === 1 ? '1 year' : `${years} years`;
    }

    return `${dateRange} (${relativeText} ago)`;
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden'
    }}>
      <List sx={{ 
        flexGrow: 1,
        overflow: 'auto'
      }}>
        <ListItem
          secondaryAction={
            !isCollapsed && (
              <IconButton onClick={() => setIsAddDialogOpen(true)}>
                <AddIcon />
              </IconButton>
            )
          }
          sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper' }}
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
                <ListItemText 
                  primary="Accounts" 
                  sx={{ mr: 3 }}
                />
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
                sx={{ 
                  pl: isCollapsed ? 2 : 4,
                  pr: 2,
                  position: 'relative'
                }}
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
                          {formatDateRange(accountDateRanges[account.id], account)}
                        </Typography>
                      </Box>
                    }
                    placement="right"
                  >
                    <Box sx={{ width: '100%', textAlign: 'center' }}>•</Box>
                  </Tooltip>
                ) : (
                  <Box sx={{ width: '100%' }}>
                    <Stack spacing={0.5} sx={{ py: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body1">
                          {account.name}
                        </Typography>
                        <IconButton 
                          onClick={() => handleImport(account)}
                          size="small"
                          sx={{ ml: 1 }}
                        >
                          <ImportIcon />
                        </IconButton>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {window.electron.processors.find(p => p.id === account.processorId)?.name}
                      </Typography>
                      <Typography 
                        variant="caption" 
                        color="text.secondary"
                      >
                        {formatDateRange(accountDateRanges[account.id], account)}
                      </Typography>
                    </Stack>
                  </Box>
                )}
              </ListItem>
            ))}
          </List>
        </Collapse>
      </List>

      {!isCollapsed && (
        <Box sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
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