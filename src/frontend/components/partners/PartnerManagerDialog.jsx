import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  Button,
  Typography,
  IconButton,
  Badge,
  Paper
} from '@mui/material';
import {
  Close as CloseIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';

// Utility function to normalize transaction descriptions for grouping
const normalizeDescription = (description) => {
  if (!description) return '';
  // Remove numbers, special characters, and extra whitespace
  return description
    .replace(/\d+/g, '')  // Remove numbers
    .replace(/[^\w\s]/g, ' ')  // Replace special chars with space
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .trim()
    .toLowerCase();
};

export function PartnerManagerDialog({ open, onClose, transactions, onUpdatePartner }) {
  const [activeTab, setActiveTab] = useState('unassigned');
  const [selectedGroup, setSelectedGroup] = useState(null);

  // Group transactions by description for easier review
  const unassignedGroups = useMemo(() => {
    if (!transactions) return {};
    
    return transactions
      .filter(tx => !tx.partners?.length)
      .reduce((groups, tx) => {
        const key = normalizeDescription(tx.description);
        if (!groups[key]) {
          groups[key] = {
            transactions: [],
            totalAmount: 0,
            count: 0
          };
        }
        groups[key].transactions.push(tx);
        groups[key].totalAmount += Math.abs(tx.amount);
        groups[key].count++;
        return groups;
      }, {});
  }, [transactions]);

  const handleAssignPartner = (group) => {
    // Use the first transaction from the group as a template
    const sampleTransaction = group.transactions[0];
    onUpdatePartner(sampleTransaction);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
    >
      <DialogTitle>
        Partner Management
        <IconButton
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'flex', height: '600px' }}>
          {/* Left sidebar with tabs */}
          <Tabs
            orientation="vertical"
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            sx={{ borderRight: 1, borderColor: 'divider', width: 200 }}
          >
            <Tab 
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Badge badgeContent={Object.keys(unassignedGroups).length} color="warning">
                    <AssignmentIcon />
                  </Badge>
                  <Typography>Unassigned</Typography>
                </Box>
              }
              value="unassigned"
            />
            <Tab label="Known Partners" value="partners" />
            <Tab label="Suggestions" value="suggestions" />
          </Tabs>

          {/* Main content area */}
          <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
            {activeTab === 'unassigned' && (
              <List>
                {Object.entries(unassignedGroups)
                  .sort(([,a], [,b]) => b.count - a.count)
                  .map(([key, group]) => (
                    <ListItem 
                      key={key}
                      component={Paper}
                      variant="outlined"
                      sx={{ mb: 1 }}
                      secondaryAction={
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleAssignPartner(group)}
                        >
                          Assign Partner
                        </Button>
                      }
                    >
                      <ListItemText
                        primary={
                          <Typography variant="subtitle2">
                            {key} ({group.count} transactions)
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            Total: {formatCurrency(group.totalAmount)}
                            <br />
                            Average: {formatCurrency(group.totalAmount / group.count)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))
                }
              </List>
            )}
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
} 