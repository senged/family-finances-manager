// src/frontend/components/AccountManager.js
import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Typography,
  IconButton
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

const AccountForm = ({ open, onClose, onSubmit, initialData = {} }) => {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    processorType: '',
    ...initialData
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
    onClose();
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {initialData.id ? 'Edit Account' : 'Create New Account'}
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Account Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                select
                label="Account Type"
                name="type"
                value={formData.type}
                onChange={handleChange}
              >
                {Object.entries(window.electron.accountTypes).map(([key, value]) => (
                  <MenuItem key={key} value={value}>
                    {key.charAt(0) + key.slice(1).toLowerCase()}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                select
                label="Transaction Processor"
                name="processorType"
                value={formData.processorType}
                onChange={handleChange}
              >
                {Object.entries(window.electron.processorTypes).map(([key, value]) => (
                  <MenuItem key={key} value={value.id}>
                    {value.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">
            {initialData.id ? 'Save Changes' : 'Create Account'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

const AccountList = ({ accounts, onEdit, onDelete }) => {
  return (
    <Grid container spacing={2}>
      {accounts.map((account) => (
        <Grid item xs={12} sm={6} md={4} key={account.id}>
          <Card>
            <CardContent>
              <Typography variant="h6" component="div">
                {account.name}
              </Typography>
              <Typography color="textSecondary">
                Type: {account.type.charAt(0).toUpperCase() + account.type.slice(1)}
              </Typography>
              <Typography color="textSecondary">
                Processor: {window.electron.processorTypes[account.processorType]?.name}
              </Typography>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <IconButton size="small" onClick={() => onEdit(account)}>
                  <EditIcon />
                </IconButton>
                <IconButton size="small" onClick={() => onDelete(account.id)}>
                  <DeleteIcon />
                </IconButton>
              </div>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export function AccountManager() {
  const [accounts, setAccounts] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);

  // Load accounts on component mount
  React.useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const loadedAccounts = await window.electron.getAccounts();
    setAccounts(loadedAccounts);
  };

  const handleCreateAccount = async (formData) => {
    await window.electron.createAccount(formData);
    loadAccounts();
  };

  const handleUpdateAccount = async (formData) => {
    await window.electron.updateAccount(editingAccount.id, formData);
    setEditingAccount(null);
    loadAccounts();
  };

  const handleDeleteAccount = async (id) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      await window.electron.deleteAccount(id);
      loadAccounts();
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography variant="h5">Accounts</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => setIsFormOpen(true)}
        >
          Add Account
        </Button>
      </div>

      <AccountList
        accounts={accounts}
        onEdit={(account) => {
          setEditingAccount(account);
          setIsFormOpen(true);
        }}
        onDelete={handleDeleteAccount}
      />

      <AccountForm
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingAccount(null);
        }}
        onSubmit={editingAccount ? handleUpdateAccount : handleCreateAccount}
        initialData={editingAccount}
      />
    </div>
  );
}