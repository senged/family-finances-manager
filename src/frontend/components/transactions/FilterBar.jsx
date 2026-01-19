import React from 'react';
import {
    Box,
    Button,
    Paper,
    TextField,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
    ExpandMore as ExpandMoreIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon
} from '@mui/icons-material';

const FilterBar = ({ filters, onFilterChange, onClearDates, accounts }) => {
    return (
        <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FilterIcon />
                    <Typography>Filters</Typography>
                </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <DatePicker
                        label="Start Date"
                        value={filters.startDate}
                        onChange={(date) => onFilterChange('startDate', date)}
                        slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                    />
                    <DatePicker
                        label="End Date"
                        value={filters.endDate}
                        onChange={(date) => onFilterChange('endDate', date)}
                        slotProps={{ textField: { size: 'small', sx: { width: 150 } } }}
                    />
                    <Button
                        size="small"
                        variant="outlined"
                        onClick={onClearDates}
                        disabled={!filters.startDate && !filters.endDate}
                    >
                        Clear Dates
                    </Button>
                    <TextField
                        label="Search Description"
                        size="small"
                        value={filters.description || ''}
                        onChange={(e) => onFilterChange('description', e.target.value)}
                        sx={{ flexGrow: 1 }}
                    />
                </Box>
            </AccordionDetails>
        </Accordion>
    );
};

export default FilterBar;
