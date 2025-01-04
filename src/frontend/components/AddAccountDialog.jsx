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

function AddAccountDialog({ open, onClose, onAdd, existingAccounts, accountTypes, processors }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [processor, setProcessor] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setType('');
      setProcessor('');
      setNameError('');
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (validateName(trimmedName) && type && processor) {
      onAdd({
        name: trimmedName,
        type,
        processorId: processor,
        stats: {
          lastImport: null,
          transactionCount: 0,
          dateRange: {
            start: null,
            end: null
          }
        },
        settings: {
          importPath: null,
          columnMappings: null,
          autoImport: false
        }
      });
      onClose();
    }
  };

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
              {accountTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
            {!type && <FormHelperText>Please select an account type</FormHelperText>}
          </FormControl>
          <FormControl fullWidth>
            <InputLabel>Transaction Processor</InputLabel>
            <Select
              value={processor}
              onChange={(e) => setProcessor(e.target.value)}
              label="Transaction Processor"
            >
              {processors.map((proc) => (
                <MenuItem key={proc.id} value={proc.id}>
                  {proc.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Select how to process account transactions</FormHelperText>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit}
          disabled={!name.trim() || !type || !processor || !!nameError}
          variant="contained"
        >
          Add Account
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddAccountDialog; 