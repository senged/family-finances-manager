import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box
} from '@mui/material';

function AddAccountDialog({ open, onClose, onAdd, existingAccounts, accountTypes = [] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [nameError, setNameError] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName('');
      setType('');
      setNameError('');
    }
  }, [open]);

  const validateName = (value) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setNameError('Account name cannot be empty');
      return false;
    }
    if (existingAccounts.some(acc => acc.name.toLowerCase() === trimmedValue.toLowerCase())) {
      setNameError('An account with this name already exists');
      return false;
    }
    setNameError('');
    return true;
  };

  const handleNameChange = (event) => {
    setName(event.target.value);
    validateName(event.target.value);
  };

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (validateName(trimmedName) && type) {
      onAdd({
        name: trimmedName,
        type
      });
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Account</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            autoFocus
            label="Account Name"
            value={name}
            onChange={handleNameChange}
            error={!!nameError}
            helperText={nameError}
            fullWidth
          />
          <FormControl fullWidth error={!type}>
            <InputLabel>Account Type</InputLabel>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              label="Account Type"
            >
              {Array.isArray(accountTypes) && accountTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
            {!type && <FormHelperText>Please select an account type</FormHelperText>}
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit}
          disabled={!name.trim() || !type || !!nameError}
          variant="contained"
        >
          Add Account
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddAccountDialog; 