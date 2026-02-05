import { createTheme, alpha } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6366f1', // Indigo 500
      light: '#818cf8',
      dark: '#4338ca',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#ec4899', // Pink 500
      light: '#f472b6',
      dark: '#db2777',
    },
    background: {
      default: '#f8fafc', // Slate 50
      paper: '#ffffff',
    },
    text: {
      primary: '#1e293b', // Slate 800
      secondary: '#64748b', // Slate 500
    },
    action: {
      hover: alpha('#6366f1', 0.04),
      selected: alpha('#6366f1', 0.08),
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontWeight: 500,
      lineHeight: 1.5,
    },
    body1: {
      lineHeight: 1.6,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none', // No uppercase buttons
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f8fafc',
          scrollbarColor: '#94a3b8 #f1f5f9',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: '#f1f5f9',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: '#94a3b8',
            borderRadius: '4px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
          border: '1px solid rgba(241, 245, 249, 1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 4px 6px -1px rgb(99 102 241 / 0.2), 0 2px 4px -2px rgb(99 102 241 / 0.1)',
            transform: 'translateY(-1px)',
          },
        },
        containedPrimary: {
           background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        }
      },
    },
    MuiPaper: {
      styleOverrides: {
        elevation1: {
           boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderTopLeftRadius: 0,
          borderBottomLeftRadius: 0,
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
          backdropFilter: 'blur(8px)',
          backgroundColor: alpha('#ffffff', 0.8),
          color: '#1e293b',
          borderBottom: '1px solid #e2e8f0',
        },
      },
    },
  },
});

export default theme;