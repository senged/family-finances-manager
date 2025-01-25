import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { formatCurrency } from '../../utils/formatters';

const PartnerTransactionsDialog = ({ partnerId, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [selectedTransactions, setSelectedTransactions] = useState(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [partnerData, transactionsData] = await Promise.all([
          window.electron.invoke('getPartner', partnerId),
          window.electron.invoke('getPartnerTransactions', partnerId)
        ]);
        
        setPartner(partnerData);
        setTransactions(transactionsData);
        // Initialize all transactions as selected
        setSelectedTransactions(new Set(transactionsData.map(t => t.id)));
      } catch (error) {
        console.error('Failed to load partner data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [partnerId]);

  const handleToggleTransaction = (transactionId) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(transactionId)) {
      newSelected.delete(transactionId);
    } else {
      newSelected.add(transactionId);
    }
    setSelectedTransactions(newSelected);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const currentTransactionIds = new Set(transactions.map(t => t.id));
      const removeTransactionIds = [...currentTransactionIds]
        .filter(id => !selectedTransactions.has(id));

      await window.electron.invoke('bulkUpdatePartnerTransactions', partnerId, {
        removeTransactionIds
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to update partner transactions:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !partner) {
    return (
      <Dialog open maxWidth="md" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open maxWidth="md" fullWidth>
      <DialogTitle>
        <Box>
          {partner.name} Transactions
          <Typography variant="subtitle2" color="text.secondary">
            {transactions.length} transactions found
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedTransactions.size === transactions.length}
                    indeterminate={selectedTransactions.size > 0 && selectedTransactions.size < transactions.length}
                    onChange={() => {
                      if (selectedTransactions.size === transactions.length) {
                        setSelectedTransactions(new Set());
                      } else {
                        setSelectedTransactions(new Set(transactions.map(t => t.id)));
                      }
                    }}
                  />
                </TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell>Category</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedTransactions.has(transaction.id)}
                      onChange={() => handleToggleTransaction(transaction.id)}
                    />
                  </TableCell>
                  <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                  <TableCell>{transaction.description}</TableCell>
                  <TableCell align="right">{formatCurrency(transaction.amount)}</TableCell>
                  <TableCell>{transaction.category}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave}
          variant="contained"
          disabled={saving}
        >
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PartnerTransactionsDialog; 