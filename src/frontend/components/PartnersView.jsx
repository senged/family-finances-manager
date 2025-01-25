import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Alert,
  Snackbar
} from '@mui/material';
import { Refresh as RefreshIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { formatCurrency } from '../utils/formatters';
import PartnerTransactionsDialog from './partners/PartnerTransactionsDialog';

const PartnersView = () => {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(false);
  const [orderBy, setOrderBy] = useState('name');
  const [order, setOrder] = useState('asc');
  const [selectedPartnerId, setSelectedPartnerId] = useState(null);
  const [error, setError] = useState(null);

  const loadPartners = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Attempting to load partners...');
      if (!window.electron || !window.electron.listPartners) {
        throw new Error('Partner management functions are not available');
      }

      const response = await window.electron.listPartners();
      console.log('Partners loaded:', response);
      setPartners(response || []);
    } catch (error) {
      console.error('Failed to load partners:', error);
      setError(error.message || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartners();
  }, []);

  const handleRefreshAll = async () => {
    setLoading(true);
    setError(null);
    try {
      await window.electron.refreshAllPartnerSummaries();
      await loadPartners();
    } catch (error) {
      console.error('Failed to refresh partner summaries:', error);
      setError(error.message || 'Failed to refresh partner summaries');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  const sortedPartners = React.useMemo(() => {
    const comparator = (a, b) => {
      let comparison = 0;
      
      if (orderBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else {
        comparison = (a[orderBy] || 0) - (b[orderBy] || 0);
      }
      
      return order === 'asc' ? comparison : -comparison;
    };

    return [...partners].sort(comparator);
  }, [partners, order, orderBy]);

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Snackbar 
          open={!!error} 
          autoHideDuration={6000} 
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setError(null)} 
            severity="error" 
            sx={{ width: '100%' }}
          >
            {error}
          </Alert>
        </Snackbar>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">Partners</Typography>
        <Button
          startIcon={<RefreshIcon />}
          onClick={handleRefreshAll}
          disabled={loading}
        >
          Refresh Summary Data
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="none" sx={{ pl: 2 }}>
                <TableSortLabel
                  active={orderBy === 'name'}
                  direction={orderBy === 'name' ? order : 'asc'}
                  onClick={() => handleSort('name')}
                >
                  Name
                </TableSortLabel>
              </TableCell>
              <TableCell padding="none">Type</TableCell>
              <TableCell padding="none">Internal</TableCell>
              <TableCell padding="none" align="right">
                <TableSortLabel
                  active={orderBy === 'transaction_count'}
                  direction={orderBy === 'transaction_count' ? order : 'asc'}
                  onClick={() => handleSort('transaction_count')}
                >
                  Transactions
                </TableSortLabel>
              </TableCell>
              <TableCell padding="none" align="right">
                <TableSortLabel
                  active={orderBy === 'total_debits'}
                  direction={orderBy === 'total_debits' ? order : 'asc'}
                  onClick={() => handleSort('total_debits')}
                >
                  Total Debits
                </TableSortLabel>
              </TableCell>
              <TableCell padding="none" align="right">
                <TableSortLabel
                  active={orderBy === 'total_credits'}
                  direction={orderBy === 'total_credits' ? order : 'asc'}
                  onClick={() => handleSort('total_credits')}
                >
                  Total Credits
                </TableSortLabel>
              </TableCell>
              <TableCell padding="none" align="right">
                <TableSortLabel
                  active={orderBy === 'net_amount'}
                  direction={orderBy === 'net_amount' ? order : 'asc'}
                  onClick={() => handleSort('net_amount')}
                >
                  Net Amount
                </TableSortLabel>
              </TableCell>
              <TableCell padding="none">Last Updated</TableCell>
              <TableCell padding="none" align="center">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPartners.map((partner) => (
              <TableRow 
                key={partner.id}
                sx={{
                  height: '36px',
                  '&:hover': { bgcolor: 'action.hover' },
                  ...(partner.is_internal && {
                    bgcolor: 'rgba(34, 47, 39, 0.6)',
                    '&:hover': { bgcolor: 'rgba(34, 47, 39, 0.8)', color: 'inherit' }
                  })
                }}
              >
                <TableCell padding="none" sx={{ pl: 2 }}>{partner.name}</TableCell>
                <TableCell padding="none">{partner.type}</TableCell>
                <TableCell padding="none">{partner.is_internal ? 'Yes' : 'No'}</TableCell>
                <TableCell padding="none" align="right">{partner.transaction_count}</TableCell>
                <TableCell padding="none" align="right">{formatCurrency(partner.total_debits)}</TableCell>
                <TableCell padding="none" align="right">{formatCurrency(partner.total_credits)}</TableCell>
                <TableCell padding="none" align="right">{formatCurrency(partner.net_amount)}</TableCell>
                <TableCell padding="none">
                  {partner.last_summary_update ? new Date(partner.last_summary_update).toLocaleString() : 'Never'}
                </TableCell>
                <TableCell padding="none" align="center">
                  <IconButton
                    size="small"
                    onClick={() => setSelectedPartnerId(partner.id)}
                    title="View Transactions"
                  >
                    <ViewIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedPartnerId && (
        <PartnerTransactionsDialog
          partnerId={selectedPartnerId}
          onClose={() => {
            setSelectedPartnerId(null);
            loadPartners(); // Refresh list after dialog closes
          }}
        />
      )}
    </Box>
  );
};

export default PartnersView; 