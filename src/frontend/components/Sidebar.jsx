// src/frontend/components/Sidebar.js
import React, { useState } from 'react';
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  IconButton
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  AccountBalance as AccountIcon,
  Add as AddIcon
} from '@mui/icons-material';
import AddAccountDialog from './AddAccountDialog';

function Sidebar({ accounts, onAccountsChange }) {
  const [accountsOpen, setAccountsOpen] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const handleAddAccount = async (accountData) => {
    try {
      await window.electron.addAccount(accountData);
      onAccountsChange(); // Refresh the accounts list
    } catch (error) {
      console.error('Error adding account:', error);
      // TODO: Show error message to user
    }
  };

  return (
    <>
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
            {accounts.length === 0 ? (
              <ListItem sx={{ pl: 4 }}>
                <ListItemText 
                  primary="No accounts"
                  primaryTypographyProps={{ color: 'text.secondary' }}
                />
              </ListItem>
            ) : (
              accounts.map((account) => (
                <ListItem key={account.id} sx={{ pl: 4 }}>
                  <ListItemText 
                    primary={account.name}
                    secondary={account.type}
                  />
                </ListItem>
              ))
            )}
          </List>
        </Collapse>
      </List>

      <AddAccountDialog
        open={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onAdd={handleAddAccount}
        existingAccounts={accounts || []}
        accountTypes={window.electron?.accountTypes || []}
      />
    </>
  );
}

export default Sidebar;