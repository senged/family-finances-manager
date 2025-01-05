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
  ButtonGroup,
  TableSortLabel
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
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
    accountIds: accounts.map(a => a.id),
    description: ''
  });
  const [pendingAccountIds, setPendingAccountIds] = useState(accounts.map(a => a.id));
  const [accountSelectOpen, setAccountSelectOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [datasetRange, setDatasetRange] = useState({ earliest: null, latest: null });
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('date');
  const [pendingDescription, setPendingDescription] = useState('');

  useEffect(() => {
    const allAccountIds = accounts.map(a => a.id);
    setFilters(prev => ({
      ...prev,
      accountIds: allAccountIds
    }));
    setPendingAccountIds(allAccountIds);
    loadDatasetRange();
  }, [accounts]);

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadDatasetRange = async () => {
    try {
      const result = await window.electron.getTransactions({
        accountId: accounts.map(a => a.id)
      });
      if (result.length > 0) {
        const dates = result.map(tx => new Date(tx.date));
        setDatasetRange({
          earliest: new Date(Math.min(...dates)),
          latest: new Date(Math.max(...dates))
        });
      } else {
        setDatasetRange({ earliest: null, latest: null });
      }
    } catch (error) {
      console.error('Error loading dataset range:', error);
      setDatasetRange({ earliest: null, latest: null });
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      if (filters.accountIds.length === 0) {
        setTransactions([]);
      } else {
        const result = await window.electron.getTransactions({
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
          accountId: filters.accountIds,
          description: filters.description
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
    
    if (datasetRange.earliest && datasetRange.latest) {
      parts.push(`Dataset spans ${format(datasetRange.earliest, 'MMM d, yyyy')} to ${format(datasetRange.latest, 'MMM d, yyyy')}`);
    }

    const filterParts = [];
    
    if (filters.startDate || filters.endDate) {
      filterParts.push('Filtered to');
      if (filters.startDate && filters.endDate) {
        filterParts.push(`${format(filters.startDate, 'MMM d, yyyy')} - ${format(filters.endDate, 'MMM d, yyyy')}`);
      } else if (filters.startDate) {
        filterParts.push(`since ${format(filters.startDate, 'MMM d, yyyy')}`);
      } else if (filters.endDate) {
        filterParts.push(`until ${format(filters.endDate, 'MMM d, yyyy')}`);
      }
    }

    if (filters.accountIds.length !== accounts.length) {
      if (filters.accountIds.length === 0) {
        filterParts.push('no accounts selected');
      } else {
        const accountNames = filters.accountIds
          .map(id => accounts.find(a => a.id === id)?.name)
          .filter(Boolean);
        filterParts.push(`for ${accountNames.join(', ')}`);
      }
    }

    if (filters.description) {
      filterParts.push(`matching description "${filters.description}"`);
    }

    if (filterParts.length > 0) {
      parts.push(filterParts.join(' '));
    }

    return parts.join('. ');
  };

  const handleClearDates = () => {
    handleFilterChange('startDate', null);
    handleFilterChange('endDate', null);
  };

  const descendingComparator = (a, b, orderBy) => {
    let aValue = a[orderBy];
    let bValue = b[orderBy];

    // Special handling for different column types
    if (orderBy === 'account_id') {
      aValue = accounts.find(acc => acc.id === a.account_id)?.name || '';
      bValue = accounts.find(acc => acc.id === b.account_id)?.name || '';
    } else if (orderBy === 'date') {
      aValue = new Date(a.date).getTime();
      bValue = new Date(b.date).getTime();
    } else if (orderBy === 'amount' || orderBy === 'balance') {
      aValue = Number(a[orderBy] || 0);
      bValue = Number(b[orderBy] || 0);
    }

    if (bValue < aValue) {
      return -1;
    }
    if (bValue > aValue) {
      return 1;
    }
    return 0;
  };

  const getComparator = (order, orderBy) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const SortableTableCell = ({ id, label, numeric = false }) => (
    <TableCell
      align={numeric ? 'right' : 'left'}
      sortDirection={orderBy === id ? order : false}
    >
      <TableSortLabel
        active={orderBy === id}
        direction={orderBy === id ? order : 'asc'}
        onClick={() => handleRequestSort(id)}
      >
        {label}
        {orderBy === id ? (
          <Box component="span" sx={visuallyHidden}>
            {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
          </Box>
        ) : null}
      </TableSortLabel>
    </TableCell>
  );

  const handleDescriptionChange = (e) => {
    setPendingDescription(e.target.value);
  };

  const handleApplyDescription = () => {
    const trimmedValue = pendingDescription.trim();
    if (trimmedValue !== filters.description) {
      handleFilterChange('description', trimmedValue);
    }
  };

  const handleClearDescription = () => {
    setPendingDescription('');
    if (filters.description) {
      handleFilterChange('description', '');
    }
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleClearDates}
                    disabled={!filters.startDate && !filters.endDate}
                  >
                    Clear Dates
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    label="Search Description"
                    value={pendingDescription}
                    onChange={handleDescriptionChange}
                    onKeyPress={(event) => {
                      if (event.key === 'Enter') {
                        handleApplyDescription();
                      }
                    }}
                    size="small"
                    sx={{ minWidth: 200 }}
                    inputProps={{
                      autoComplete: 'off',
                      spellCheck: false
                    }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleApplyDescription}
                    disabled={pendingDescription.trim() === filters.description}
                  >
                    Apply
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleClearDescription}
                    disabled={!pendingDescription && !filters.description}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>

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
                <SortableTableCell id="date" label="Date" />
                <SortableTableCell id="account_id" label="Account" />
                <SortableTableCell id="description" label="Description" />
                <SortableTableCell id="amount" label="Amount" numeric />
                <SortableTableCell id="type" label="Type" />
                <SortableTableCell id="balance" label="Balance" numeric />
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
                [...transactions]
                  .sort(getComparator(order, orderBy))
                  .map((tx) => (
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