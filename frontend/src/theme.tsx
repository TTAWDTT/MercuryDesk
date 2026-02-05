import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme, alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ColorMode = 'light' | 'dark';

interface ColorModeContextType {
  mode: ColorMode;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: 'light',
  toggleColorMode: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem('theme_mode');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const toggleColorMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme_mode', next);
      return next;
    });
  };

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
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
        default: mode === 'light' ? '#f8fafc' : '#0f172a', // Slate 50 / Slate 900
        paper: mode === 'light' ? '#ffffff' : '#1e293b',   // White / Slate 800
      },
      text: {
        primary: mode === 'light' ? '#1e293b' : '#f8fafc', // Slate 800 / Slate 50
        secondary: mode === 'light' ? '#64748b' : '#94a3b8', // Slate 500 / Slate 400
      },
      action: {
        hover: alpha('#6366f1', 0.08),
        selected: alpha('#6366f1', 0.12),
      },
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 500, lineHeight: 1.5 },
      body1: { lineHeight: 1.6 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    // Keep a small base radius so sx values like `borderRadius: 3` stay reasonable.
    shape: { borderRadius: 4 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: mode === 'light' ? '#f8fafc' : '#0f172a',
            scrollbarColor: mode === 'light' ? '#94a3b8 #f1f5f9' : '#475569 #1e293b',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { backgroundColor: mode === 'light' ? '#f1f5f9' : '#1e293b' },
            '&::-webkit-scrollbar-thumb': { 
                backgroundColor: mode === 'light' ? '#94a3b8' : '#475569',
                borderRadius: '4px',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            backgroundImage: 'none', // Disable default elevation gradient in dark mode
            boxShadow: mode === 'light' 
                ? '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)'
                : '0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
            border: `1px solid ${mode === 'light' ? alpha('#e2e8f0', 0.8) : alpha('#334155', 0.6)}`,
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
              boxShadow: `0 4px 12px ${alpha('#6366f1', 0.2)}`,
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
             boxShadow: mode === 'light'
                ? '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)'
                : 'none',
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${mode === 'light' ? '#e2e8f0' : '#1e293b'}`,
            backdropFilter: 'blur(12px)',
            backgroundColor: mode === 'light' ? alpha('#ffffff', 0.8) : alpha('#0f172a', 0.8),
            color: mode === 'light' ? '#1e293b' : '#f8fafc',
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
            root: {
                '&.Mui-disabled': {
                    color: mode === 'light' ? 'rgba(0, 0, 0, 0.38)' : 'rgba(255, 255, 255, 0.5)',
                }
            }
        }
      },
      MuiOutlinedInput: {
          styleOverrides: {
              notchedOutline: {
                  borderColor: mode === 'light' ? 'rgba(0, 0, 0, 0.23)' : 'rgba(255, 255, 255, 0.23)',
              }
          }
      }
    },
  }), [mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
