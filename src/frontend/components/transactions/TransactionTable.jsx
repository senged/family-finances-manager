import React from 'react';
import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Chip
} from '@mui/material';

const TransactionTable = ({ transactions, loading }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString();
    };

    if (loading) return <Typography sx={{ p: 3 }}>Loading transactions...</Typography>;
    if (!transactions?.length) return <Typography sx={{ p: 3 }}>No transactions found.</Typography>;

    return (
        <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: 'auto' }}>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Account</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Partner</TableCell>
                        <TableCell align="right">Amount</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {transactions.map((tx) => (
                        <TableRow key={tx.global_id} hover>
                            <TableCell>{formatDate(tx.date)}</TableCell>
                            <TableCell>{tx.account_name}</TableCell>
                            <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {tx.description}
                            </TableCell>
                            <TableCell>
                                {tx.partner_name ? (
                                    <Chip
                                        label={tx.partner_name}
                                        size="small"
                                        color={tx.partner_is_internal ? "secondary" : "default"}
                                    />
                                ) : (
                                    <Typography variant="caption" color="text.secondary">Unassigned</Typography>
                                )}
                            </TableCell>
                            <TableCell align="right" sx={{ color: tx.amount < 0 ? 'error.main' : 'success.main', fontWeight: 'bold' }}>
                                {formatCurrency(tx.amount)}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default TransactionTable;
