import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, CssBaseline, Drawer, AppBar, Toolbar, Typography } from '@mui/material';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import { AccountManager } from './components/AccountManager';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4f6d7a',
    },
    secondary: {
      main: '#c0d6df',
    },
    background: {
      default: '#f4f4f4',
      paper: '#ffffff',
    },
    text: {
      primary: '#2c3e50',
      secondary: '#546e7a',
    },
  },
});

function App() {
  // NEW: State for accounts and processors
  const [selectedView, setSelectedView] = useState('dashboard');
  const [accounts, setAccounts] = useState([]);
  const [processors, setProcessors] = useState([]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showProcessorForm, setShowProcessorForm] = useState(false);

  // NEW: Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // NEW: Data loading function
  const loadData = async () => {
    try {
      const loadedAccounts = await window.electron.getAccounts();
      const loadedProcessors = await window.electron.getProcessors();
      setAccounts(loadedAccounts);
      setProcessors(loadedProcessors);
    } catch (error) {
      console.error('Error loading data:', error);
      // You might want to add error handling UI here
    }
  };

  // NEW: Handle selection and creation
  const handleAccountSelect = (account) => {
    console.log('Selected account:', account);
    // Add account selection logic
  };

  const handleProcessorSelect = (processor) => {
    console.log('Selected processor:', processor);
    // Add processor selection logic
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{ width: `calc(100% - ${240}px)`, ml: '240px' }}
        >
          <Toolbar>
            <Typography variant="h6" noWrap component="div">
              Family Finance Manager
            </Typography>
          </Toolbar>
        </AppBar>
        
        {/* MODIFIED: Enhanced Sidebar with new props */}
        <Drawer
          sx={{
            width: 240,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 240,
              boxSizing: 'border-box',
            },
          }}
          variant="permanent"
          anchor="left"
        >
          <Sidebar 
            selectedView={selectedView}
            setSelectedView={setSelectedView}
            accounts={accounts}
            processors={processors}
            onAddAccount={() => setShowAccountForm(true)}
            onAddProcessor={() => setShowProcessorForm(true)}
            onSelectAccount={handleAccountSelect}
            onSelectProcessor={handleProcessorSelect}
          />
        </Drawer>

        <Box
          component="main"
          sx={{ flexGrow: 1, bgcolor: 'background.default', p: 3 }}
        >
          <Toolbar />
          {selectedView === 'dashboard' && <Dashboard />}
          {selectedView === 'accounts' && <AccountManager />}
          {/* Add other views as needed */}
        </Box>
      </Box>

      {/* TODO: Add AccountForm and ProcessorForm components */}
    </ThemeProvider>
  );
}

export default App;