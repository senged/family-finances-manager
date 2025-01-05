import React, { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  MenuItem,
  Box,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Checkbox,
  ListItemText,
  Chip,
  Button,
  Stack,
  ButtonGroup
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import format from 'date-fns/format';

function TransactionsView({ accounts }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    accountIds: accounts.map(a => a.id)
  });
  const [pendingAccountIds, setPendingAccountIds] = useState(accounts.map(a => a.id));
  const [accountSelectOpen, setAccountSelectOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const allAccountIds = accounts.map(a => a.id);
    setFilters(prev => ({
      ...prev,
      accountIds: allAccountIds
    }));
    setPendingAccountIds(allAccountIds);
  }, [accounts]);

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      if (filters.accountIds.length === 0) {
        setTransactions([]);
      } else {
        const result = await window.electron.getTransactions({
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
          accountId: filters.accountIds
        });
        setTransactions(result);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAccountSelection = (event, accountId) => {
    event.preventDefault();
    event.stopPropagation();
    const newPendingIds = pendingAccountIds.includes(accountId)
      ? pendingAccountIds.filter(id => id !== accountId)
      : [...pendingAccountIds, accountId];
    setPendingAccountIds(newPendingIds);
    setHasChanges(true);
  };

  const handleApplyAccountSelection = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    handleFilterChange('accountIds', pendingAccountIds);
    setAccountSelectOpen(false);
    setHasChanges(false);
  };

  const handleCancelAccountSelection = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setPendingAccountIds(filters.accountIds);
    setAccountSelectOpen(false);
    setHasChanges(false);
  };

  const handleSelectAllAccounts = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setPendingAccountIds(accounts.map(a => a.id));
    setHasChanges(true);
  };

  const handleSelectNoAccounts = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setPendingAccountIds([]);
    setHasChanges(true);
  };

  const handleDropdownClose = (event) => {
    if (hasChanges) {
      event.preventDefault();
      return;
    }
    setAccountSelectOpen(false);
  };

  const getAccountSelectionLabel = () => {
    const totalAccounts = accounts.length;
    const selectedIds = filters.accountIds || [];
    const selectedCount = selectedIds.length;

    if (!selectedIds || selectedCount === 0) {
      return 'No Accounts Selected';
    } else if (selectedCount === totalAccounts) {
      return `All (${totalAccounts}) Accounts Selected`;
    } else {
      return `${selectedCount}/${totalAccounts} Accounts Selected`;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const getFilterSummary = () => {
    const parts = [];
    
    if (filters.startDate && filters.endDate) {
      parts.push(`from ${format(filters.startDate, 'MMM d, yyyy')} to ${format(filters.endDate, 'MMM d, yyyy')}`);
    } else if (filters.startDate) {
      parts.push(`since ${format(filters.startDate, 'MMM d, yyyy')}`);
    } else if (filters.endDate) {
      parts.push(`until ${format(filters.endDate, 'MMM d, yyyy')}`);
    }

    if (filters.accountIds.length > 0) {
      if (filters.accountIds.length === accounts.length) {
        parts.push('all accounts');
      } else {
        const accountNames = filters.accountIds
          .map(id => accounts.find(a => a.id === id)?.name)
          .filter(Boolean);
        parts.push(`for ${accountNames.join(', ')}`);
      }
    } else {
      parts.push('no accounts selected');
    }

    return `Showing transactions ${parts.join(' ')}`;
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Sticky Filter Controls */}
        <Paper sx={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 1,
          p: 2,
          borderRadius: 0
        }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <DatePicker
                label="Start Date"
                value={filters.startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                slotProps={{ textField: { size: 'small' } }}
              />
              <DatePicker
                label="End Date"
                value={filters.endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                slotProps={{ textField: { size: 'small' } }}
              />
              <FormControl sx={{ minWidth: 250 }} size="small">
                <InputLabel>Accounts</InputLabel>
                <Select
                  multiple
                  open={accountSelectOpen}
                  onOpen={() => setAccountSelectOpen(true)}
                  onClose={handleDropdownClose}
                  value={filters.accountIds || []}
                  label="Accounts"
                  onChange={() => {}}
                  renderValue={getAccountSelectionLabel}
                  MenuProps={{
                    PaperProps: {
                      sx: { 
                        maxHeight: 400,
                        '& .MuiList-root': {
                          padding: 0
                        }
                      }
                    }
                  }}
                >
                  <Box sx={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    minHeight: 200
                  }}>
                    {/* Account List */}
                    <Box sx={{ 
                      flexGrow: 1, 
                      overflow: 'auto',
                      minHeight: 100
                    }}>
                      {accounts.map((account) => (
                        <MenuItem 
                          key={account.id} 
                          value={account.id}
                          onClick={(event) => handleAccountSelection(event, account.id)}
                          dense
                          sx={{ py: 0 }}
                        >
                          <Checkbox 
                            checked={pendingAccountIds.includes(account.id)}
                            onChange={(event) => handleAccountSelection(event, account.id)}
                            onClick={(event) => event.stopPropagation()}
                            size="small"
                          />
                          <ListItemText 
                            primary={account.name}
                            primaryTypographyProps={{
                              variant: 'body2'
                            }}
                          />
                        </MenuItem>
                      ))}
                    </Box>

                    {/* Action Bar */}
                    <Box sx={{ 
                      borderTop: 1, 
                      borderColor: 'divider',
                      p: 1,
                      display: 'flex', 
                      justifyContent: 'space-between',
                      backgroundColor: 'background.paper',
                      position: 'sticky',
                      bottom: 0,
                      zIndex: 1
                    }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                          size="small" 
                          onClick={handleSelectNoAccounts}
                          variant="outlined"
                        >
                          Clear
                        </Button>
                        <Button 
                          size="small" 
                          onClick={handleSelectAllAccounts}
                          variant="outlined"
                        >
                          Select All
                        </Button>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button 
                          size="small" 
                          onClick={handleCancelAccountSelection}
                          variant="outlined"
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="small" 
                          variant="contained" 
                          onClick={handleApplyAccountSelection}
                          color="primary"
                        >
                          Apply
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </Select>
              </FormControl>
            </Box>

            <Typography variant="body2" color="text.secondary">
              {getFilterSummary()}
            </Typography>
          </Stack>
        </Paper>

        {/* Scrollable Table */}
        <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography>Loading transactions...</Typography>
                  </TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography>No transactions found</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.global_id}>
                    <TableCell>{formatDate(tx.date)}</TableCell>
                    <TableCell>
                      {accounts.find(a => a.id === tx.account_id)?.name || tx.account_id}
                    </TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell align="right">{formatCurrency(tx.amount)}</TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell align="right">
                      {tx.balance ? formatCurrency(tx.balance) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </LocalizationProvider>
  );
}

export default TransactionsView; 