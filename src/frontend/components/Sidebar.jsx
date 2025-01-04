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
  Box
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  AccountBalance as AccountIcon,
  CloudUpload as ImportIcon,
  Add as AddIcon
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

  return (
    <Box>
      <List>
        <ListItem
          secondaryAction={
            <IconButton edge="end" onClick={() => setIsAddDialogOpen(true)}>
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
              >
                <ListItemText 
                  primary={account.name}
                  secondary={`${account.type} - ${
                    window.electron.processors.find(p => p.id === account.processorId)?.name || account.processorId
                  }`}
                />
                <IconButton 
                  onClick={() => handleImport(account)}
                  size="small"
                >
                  <ImportIcon />
                </IconButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </List>

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