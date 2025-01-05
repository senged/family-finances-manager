import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ListItemText,
  Typography,
  Stack,
  Divider
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

export function AssignPartnerDialog({ 
  open, 
  onClose, 
  transaction, 
  existingPartners,
  onAssign,
  onCreateNew 
}) {
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>
        Assign Partner
        <Typography variant="subtitle2" color="text.secondary">
          {transaction?.description}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <FormControl fullWidth>
            <InputLabel>Select Existing Partner</InputLabel>
            <Select
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
              label="Select Existing Partner"
            >
              {existingPartners?.map(partner => (
                <MenuItem key={partner.id} value={partner.id}>
                  <ListItemText
                    primary={partner.name}
                    secondary={partner.type}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Divider>or</Divider>
          
          <Button
            variant="outlined"
            onClick={() => onCreateNew(transaction)}
            startIcon={<AddIcon />}
          >
            Create New Partner from This Transaction
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained"
          disabled={!selectedPartnerId}
          onClick={() => onAssign(selectedPartnerId)}
        >
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
} 