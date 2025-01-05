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
  Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

function TransactionsView({ accounts }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: null,
    endDate: null,
    accountId: 'all'
  });

  useEffect(() => {
    loadTransactions();
  }, [filters]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const result = await window.electron.getTransactions({
        startDate: filters.startDate?.toISOString(),
        endDate: filters.endDate?.toISOString(),
        accountId: filters.accountId === 'all' ? null : filters.accountId
      });
      setTransactions(result);
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 2 }}>
        {/* Filters */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
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
          <FormControl sx={{ minWidth: 200 }} size="small">
            <InputLabel>Account</InputLabel>
            <Select
              value={filters.accountId}
              label="Account"
              onChange={(e) => handleFilterChange('accountId', e.target.value)}
            >
              <MenuItem value="all">All Accounts</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Transactions Table */}
        <TableContainer component={Paper}>
          <Table size="small">
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