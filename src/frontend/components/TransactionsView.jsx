import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  TableSortLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Grid
} from '@mui/material';
import { visuallyHidden } from '@mui/utils';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import format from 'date-fns/format';
import {
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterIcon,
  Assessment as AssessmentIcon,
} from '@mui/icons-material';
import { 
  differenceInDays, 
  differenceInMonths, 
  differenceInYears 
} from 'date-fns';
import { PartnerManagerDialog } from './partners/PartnerManagerDialog';
import { AssignPartnerDialog } from './partners/AssignPartnerDialog';
import debounce from 'lodash/debounce';

function TransactionsView({ accounts }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    accountIds: accounts.map(a => a.id),
    description: ''
  });
  const [partners, setPartners] = useState([]);
  const [pendingAccountIds, setPendingAccountIds] = useState(accounts.map(a => a.id));
  const [accountSelectOpen, setAccountSelectOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [datasetRange, setDatasetRange] = useState({ earliest: null, latest: null });
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('date');
  const [pendingDescription, setPendingDescription] = useState('');
  const [showPartnerManager, setShowPartnerManager] = useState(false);
  const [partnerDialogTransaction, setPartnerDialogTransaction] = useState(null);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [searchText, setSearchText] = useState('');

  // Create debounced filter update once at component initialization
  const debouncedUpdateFilter = useMemo(
    () => debounce((value) => {
      setFilters(prev => ({
        ...prev,
        description: value
      }));
    }, 750),
    []
  );

  // Simple input handler - just updates UI state
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchText(value);  // Update UI immediately
    debouncedUpdateFilter(value);  // Schedule the filter update
  };

  // Clear handler
  const handleClearSearch = () => {
    debouncedUpdateFilter.cancel();
    setSearchText('');
    setFilters(prev => ({
      ...prev,
      description: ''
    }));
  };

  // Memoize loadTransactions to prevent recreation
  const loadTransactions = useCallback(async () => {
    console.log('Loading transactions with filters:', filters);
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
        console.log(`Loaded ${result.length} transactions`);
        setTransactions(result);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]); // Only recreate when filters change

  // Add logging to the filters effect
  useEffect(() => {
    console.log('EFFECT: filters changed:', filters);
    loadTransactions();
  }, [filters]); // Only depend on filters, not loadTransactions

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
    const count = transactions.filter(tx => !tx.partners?.length).length;
    setUnassignedCount(count);
  }, [transactions]);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      if (!window.electron?.getPartners) {
        console.warn('Partner functionality not available');
        setPartners([]);
        return;
      }
      const result = await window.electron.getPartners();
      setPartners(result || []);
    } catch (error) {
      console.error('Error loading partners:', error);
      setPartners([]);
    }
  };

  const handleAssignPartner = async (partnerId) => {
    if (!partnerDialogTransaction || !partnerId) return;
    
    try {
      await window.electron.assignTransactionPartner({
        transactionId: partnerDialogTransaction.global_id,
        partnerId,
        role: partnerDialogTransaction.amount < 0 ? 'destination' : 'source'
      });
      await loadTransactions();
      setPartnerDialogTransaction(null);
    } catch (error) {
      console.error('Error assigning partner:', error);
    }
  };

  const handleCreatePartner = async (transaction) => {
    try {
      const newPartner = await window.electron.createPartner({
        type: transaction.amount < 0 ? 'MERCHANT' : 'INSTITUTION',
        name: transaction.description,
        aliases: [transaction.description],
        categories: []
      });
      
      await handleAssignPartner(newPartner.id);
      await loadPartners();
    } catch (error) {
      console.error('Error creating partner:', error);
    }
  };

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

  const formatDateDuration = (startDate, endDate) => {
    if (!startDate || !endDate) return '';

    const days = differenceInDays(endDate, startDate);
    const totalYears = days / 365.25;
    const totalMonths = days / (365.25 / 12);
    const totalWeeks = days / 7;

    let duration = '';
    if (totalYears >= 1) {
      duration = `${totalYears.toFixed(1)} ${totalYears === 1 ? 'year' : 'years'}`;
    } else if (totalMonths >= 1) {
      duration = `${totalMonths.toFixed(1)} ${totalMonths === 1 ? 'month' : 'months'}`;
    } else if (totalWeeks >= 1) {
      duration = `${totalWeeks.toFixed(1)} ${totalWeeks === 1 ? 'week' : 'weeks'}`;
    } else {
      duration = `${days} ${days === 1 ? 'day' : 'days'}`;
    }

    return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')} (${duration})`;
  };

  const TransactionSummary = ({ transactions }) => {
    const calculateSummary = () => {
      const summary = {
        inflows: 0,
        outflows: 0,
        transfers: 0,
        firstDate: null,
        lastDate: null,
      };

      transactions.forEach(tx => {
        const amount = Number(tx.amount);
        const date = new Date(tx.date);

        // Track date range
        if (!summary.firstDate || date < summary.firstDate) {
          summary.firstDate = date;
        }
        if (!summary.lastDate || date > summary.lastDate) {
          summary.lastDate = date;
        }

        // Categorize transaction
        if (tx.type === 'transfer') {
          summary.transfers += Math.abs(amount);
        } else if (amount > 0) {
          summary.inflows += amount;
        } else {
          summary.outflows += Math.abs(amount);
        }
      });

      // Calculate net
      summary.net = summary.inflows - summary.outflows;

      // Calculate time-based averages if we have a date range
      if (summary.firstDate && summary.lastDate) {
        const daysDiff = (summary.lastDate - summary.firstDate) / (1000 * 60 * 60 * 24);
        if (daysDiff > 0) {
          const dailyNet = summary.net / daysDiff;
          summary.monthlyNet = dailyNet * (365.25 / 12);
          summary.yearlyNet = dailyNet * 365.25;

          const dailyInflow = summary.inflows / daysDiff;
          summary.monthlyInflow = dailyInflow * (365.25 / 12);
          summary.yearlyInflow = dailyInflow * 365.25;

          const dailyOutflow = summary.outflows / daysDiff;
          summary.monthlyOutflow = dailyOutflow * (365.25 / 12);
          summary.yearlyOutflow = dailyOutflow * 365.25;
        }
      }

      return summary;
    };

    const summary = calculateSummary();
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(amount);
    };

    return (
      <Box sx={{ p: 0.5 }}>
        <Grid container spacing={0.5}>
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ 
                  minHeight: 40,
                  '& .MuiAccordionSummary-content': {
                    my: 0
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssessmentIcon />
                  <Typography>Transaction Summary</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0.5 }}>
                <Grid container spacing={0.5}>
                  <Grid item xs={12}>
                    <Paper sx={{ p: 0.5, bgcolor: 'background.paper' }}>
                      <Grid container spacing={1} alignItems="center">
                        <Grid item xs={12} sm={4}>
                          <Typography variant="caption" color="text.secondary">
                            Transaction Count
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {transactions.length.toLocaleString()}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <Typography variant="caption" color="text.secondary">
                            Date Range
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {summary.firstDate && summary.lastDate ? 
                              formatDateDuration(summary.firstDate, summary.lastDate) : 
                              'No transactions'
                            }
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ pl: 0.5 }}>
                      Transaction Totals
                    </Typography>
                    <Grid container spacing={0.5}>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ 
                          p: 0.5, 
                          bgcolor: 'success.light', 
                          color: 'success.contrastText',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <Typography variant="caption">Total Inflows</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.inflows)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ 
                          p: 0.5, 
                          bgcolor: 'error.light', 
                          color: 'error.contrastText',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <Typography variant="caption">Total Outflows</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.outflows)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ 
                          p: 0.5, 
                          bgcolor: summary.net >= 0 ? 'success.light' : 'error.light', 
                          color: 'white',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          <Typography variant="caption">Net Total</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.net)}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ pl: 0.5 }}>
                      Monthly Averages
                    </Typography>
                    <Grid container spacing={0.5}>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 0.5 }}>
                          <Typography variant="caption">Average Monthly Inflow</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.monthlyInflow || 0)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 0.5 }}>
                          <Typography variant="caption">Average Monthly Outflow</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.monthlyOutflow || 0)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 0.5 }}>
                          <Typography variant="caption">Average Monthly Net</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.monthlyNet || 0)}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="caption" sx={{ pl: 0.5 }}>
                      Yearly Averages
                    </Typography>
                    <Grid container spacing={0.5}>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 0.5 }}>
                          <Typography variant="caption">Average Yearly Inflow</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.yearlyInflow || 0)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 0.5 }}>
                          <Typography variant="caption">Average Yearly Outflow</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.yearlyOutflow || 0)}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 0.5 }}>
                          <Typography variant="caption">Average Yearly Net</Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatCurrency(summary.yearlyNet || 0)}
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Grid>

                  {summary.transfers > 0 && (
                    <Grid item xs={12}>
                      <Paper sx={{ 
                        p: 0.5, 
                        bgcolor: 'info.light', 
                        color: 'info.contrastText',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <Typography variant="caption">Total Transfers (not included in net calculations)</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {formatCurrency(summary.transfers)}
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      </Box>
    );
  };

  const handleEditTransactionPartner = (transaction) => {
    setPartnerDialogTransaction(transaction);
  };

  const handleRemoveTransactionPartner = async (transaction, partnerId) => {
    try {
      await window.electron.removeTransactionPartner(transaction.global_id, partnerId);
      await loadTransactions();
    } catch (error) {
      console.error('Error removing partner:', error);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => debouncedUpdateFilter.cancel();
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <Paper sx={{ 
          borderRadius: 0
        }}>
          {/* Filters Accordion */}
          <Accordion defaultExpanded>
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ 
                minHeight: 40,
                bgcolor: 'background.default',
                '& .MuiAccordionSummary-content': {
                  my: 0
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FilterIcon />
                <Typography>Filters</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Date Filters */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <DatePicker
                    label="Start Date"
                    value={filters.startDate}
                    onChange={(date) => handleFilterChange('startDate', date)}
                    slotProps={{ 
                      textField: { 
                        size: 'small',
                        sx: { width: '130px' }
                      }
                    }}
                  />
                  <DatePicker
                    label="End Date"
                    value={filters.endDate}
                    onChange={(date) => handleFilterChange('endDate', date)}
                    slotProps={{ 
                      textField: { 
                        size: 'small',
                        sx: { width: '130px' }
                      }
                    }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleClearDates}
                    disabled={!filters.startDate && !filters.endDate}
                  >
                    Clear
                  </Button>
                </Box>

                <Divider orientation="vertical" flexItem />

                {/* Account Filter */}
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    multiple
                    open={accountSelectOpen}
                    onOpen={() => setAccountSelectOpen(true)}
                    onClose={handleDropdownClose}
                    value={filters.accountIds}
                    onChange={() => {}}  // Handle changes through the MenuItem clicks instead
                    renderValue={(selected) => {
                      if (selected.length === 0) {
                        return 'Select Accounts';
                      }
                      if (selected.length === accounts.length) {
                        return 'All Accounts';
                      }
                      return `${selected.length} Account${selected.length === 1 ? '' : 's'}`;
                    }}
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

                <Divider orientation="vertical" flexItem />

                {/* Description Search */}
                <Box sx={{ display: 'flex', gap: 0.5, flexGrow: 1 }}>
                  <TextField
                    fullWidth
                    label="Search Description"
                    value={searchText}
                    onChange={handleSearchChange}
                    size="small"
                    inputProps={{
                      autoComplete: 'off',
                      spellCheck: false
                    }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleClearSearch}
                    disabled={!searchText && !filters.description}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
            </AccordionDetails>
          </Accordion>

          <Divider />

          {/* Transaction Summary */}
          <TransactionSummary transactions={transactions} />
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

      <PartnerManagerDialog
        open={showPartnerManager}
        onClose={() => setShowPartnerManager(false)}
        transactions={transactions}
        onUpdatePartner={loadTransactions}
      />
      
      <AssignPartnerDialog
        open={!!partnerDialogTransaction}
        onClose={() => setPartnerDialogTransaction(null)}
        transaction={partnerDialogTransaction}
        existingPartners={partners}
        onAssign={handleAssignPartner}
        onCreateNew={handleCreatePartner}
      />
    </LocalizationProvider>
  );
}

export default TransactionsView; 