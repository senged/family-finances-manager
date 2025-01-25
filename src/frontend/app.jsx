import React, { useState, useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  Box, 
  CssBaseline, 
  Drawer, 
  AppBar, 
  Toolbar, 
  Typography, 
  Tabs, 
  Tab,
  IconButton
} from '@mui/material';
import {
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon
} from '@mui/icons-material';
import Sidebar from './components/Sidebar';
import TransactionsView from './components/TransactionsView';
import PartnersView from './components/PartnersView';

const DRAWER_WIDTH = 320;
const COLLAPSED_WIDTH = 48;

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4f6d7a',
    },
    secondary: {
      main: '#c0d6df',
    },
    background: {
      default: '#2c2c2c',
      paper: '#333333',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0b0b0',
    },
  },
});

function TabPanel({ children, value, index }) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      sx={{ flexGrow: 1, overflow: 'auto' }}
    >
      {value === index && children}
    </Box>
  );
}

function App() {
  const [accounts, setAccounts] = useState([]);
  const [currentTab, setCurrentTab] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const loadedAccounts = await window.electron.getAccounts();
      setAccounts(loadedAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAccounts([]);
    }
  };

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <AppBar 
          position="fixed" 
          sx={{ 
            zIndex: (theme) => theme.zIndex.drawer + 1,
            transition: theme.transitions.create(['width', 'margin'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            ...(sidebarOpen && {
              marginLeft: DRAWER_WIDTH,
              width: `calc(100% - ${DRAWER_WIDTH}px)`,
              transition: theme.transitions.create(['width', 'margin'], {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
            }),
          }}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="toggle sidebar"
              onClick={toggleSidebar}
              edge="start"
              sx={{ mr: 2 }}
            >
              {sidebarOpen ? <ChevronLeftIcon /> : <MenuIcon />}
            </IconButton>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
              Family Finance Manager
            </Typography>
          </Toolbar>
          <Tabs 
            value={currentTab} 
            onChange={handleTabChange}
            sx={{ backgroundColor: 'background.paper' }}
          >
            <Tab label="Transactions" />
            <Tab label="Partners" />
            <Tab label="Analysis" />
            <Tab label="Reports" />
          </Tabs>
        </AppBar>

        <Drawer
          variant="permanent"
          open={sidebarOpen}
          sx={{
            width: sidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
            '& .MuiDrawer-paper': {
              width: sidebarOpen ? DRAWER_WIDTH : COLLAPSED_WIDTH,
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.enteringScreen,
              }),
              overflowX: 'hidden',
            },
          }}
        >
          <Toolbar /> {/* Space for AppBar */}
          <Toolbar /> {/* Space for Tabs */}
          <Sidebar accounts={accounts} onAccountsChange={loadAccounts} isCollapsed={!sidebarOpen} />
        </Drawer>

        <Box component="main" sx={{ 
          flexGrow: 1, 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <Toolbar /> {/* Space for AppBar */}
          <Toolbar /> {/* Space for Tabs */}
          
          <TabPanel value={currentTab} index={0}>
            <TransactionsView accounts={accounts} />
          </TabPanel>
          
          <TabPanel value={currentTab} index={1}>
            <PartnersView />
          </TabPanel>
          
          <TabPanel value={currentTab} index={2}>
            <Typography variant="h5" sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
              Analysis View (Coming Soon)
            </Typography>
          </TabPanel>
          
          <TabPanel value={currentTab} index={3}>
            <Typography variant="h5" sx={{ p: 3, color: 'text.secondary', textAlign: 'center' }}>
              Reports View (Coming Soon)
            </Typography>
          </TabPanel>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App; 