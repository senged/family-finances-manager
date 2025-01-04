import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid
} from '@mui/material';

const AddAccountDialog = ({ 
  open, 
  onClose, 
  onAdd, 
  existingAccounts, 
  accountTypes, 
  processors 
}) => {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    processorType: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(formData);
    setFormData({ name: '', type: '', processorType: '' });
    onClose();
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Convert accountTypes object to array of entries
  const accountTypeEntries = Object.entries(accountTypes || {}).map(([key, value]) => ({
    key,
    value,
    label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase()
  }));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Account</DialogTitle>
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
                {accountTypeEntries.map(({ key, value, label }) => (
                  <MenuItem key={key} value={value}>
                    {label}
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
                {processors.map((processor) => (
                  <MenuItem key={processor.id} value={processor.id}>
                    {processor.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="primary">
            Add Account
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AddAccountDialog; 