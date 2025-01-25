import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Box,
  Typography,
  Divider,
  CircularProgress,
  Fab
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { formatCurrency } from '../../utils/formatters';

const AssignPartnerDialog = ({ transaction, onClose, onAssign, onCreateNew }) => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    setLoading(true);
    try {
      const response = await window.electron.listPartners();
      setPartners(response || []);
    } catch (error) {
      console.error('Failed to load partners:', error);
      setError('Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = partners.filter(partner => 
    partner.name.toLowerCase().includes(search.toLowerCase()) ||
    (partner.aliases && JSON.parse(partner.aliases)
      .some(alias => alias.toLowerCase().includes(search.toLowerCase())))
  );

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
  };

  const handleClearSearch = () => {
    setSearch('');
  };

  const handleAssign = (partner) => {
    onAssign(partner);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Assign Partner to Transaction
        <Typography variant="subtitle2" color="text.secondary">
          {transaction.description} ({formatCurrency(transaction.amount)})
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search partners..."
            value={search}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'action.active', mr: 1 }} />,
              endAdornment: search && (
                <IconButton size="small" onClick={handleClearSearch}>
                  <ClearIcon />
                </IconButton>
              )
            }}
          />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Typography color="error" align="center">{error}</Typography>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredPartners.map((partner) => (
              <React.Fragment key={partner.id}>
                <ListItem button onClick={() => handleAssign(partner)}>
                  <ListItemText
                    primary={partner.name}
                    secondary={partner.type}
                  />
                  <ListItemSecondaryAction>
                    <Typography variant="body2" color="text.secondary">
                      {partner.transaction_count} transactions
                    </Typography>
                  </ListItemSecondaryAction>
                </ListItem>
                <Divider />
              </React.Fragment>
            ))}
            {filteredPartners.length === 0 && (
              <Typography sx={{ p: 2 }} color="text.secondary" align="center">
                No matching partners found
              </Typography>
            )}
          </List>
        )}

        <Fab
          color="primary"
          size="medium"
          onClick={() => {
            onCreateNew(transaction);
            onClose();
          }}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
          }}
        >
          <AddIcon />
        </Fab>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignPartnerDialog; 