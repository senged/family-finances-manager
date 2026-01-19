import React from 'react';
import { Paper, Grid, Typography, Box, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Assessment as AssessmentIcon
} from '@mui/icons-material';

const SummaryDashboard = ({ summary }) => {
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    if (!summary) return null;

    const net = (summary.inflows || 0) - (summary.outflows || 0);

    return (
        <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssessmentIcon />
                    <Typography>Summary</Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 2, bgcolor: 'success.dark', color: 'white' }}>
                            <Typography variant="caption">Inflows</Typography>
                            <Typography variant="h6">{formatCurrency(summary.inflows)}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 2, bgcolor: 'error.dark', color: 'white' }}>
                            <Typography variant="caption">Outflows</Typography>
                            <Typography variant="h6">{formatCurrency(summary.outflows)}</Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Paper sx={{ p: 2, bgcolor: net >= 0 ? 'success.main' : 'error.main', color: 'white' }}>
                            <Typography variant="caption">Net</Typography>
                            <Typography variant="h6">{formatCurrency(net)}</Typography>
                        </Paper>
                    </Grid>
                </Grid>
            </AccordionDetails>
        </Accordion>
    );
};

export default SummaryDashboard;
