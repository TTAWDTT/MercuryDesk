import React, { createContext, useContext, useMemo, useState } from 'react';
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

  const lightPalette = {
    primary: '#7A4B2A',
    secondary: '#B68457',
    background: '#ECE2CF',
    paper: '#F4E8D5',
    textPrimary: '#2A1F14',
    textSecondary: '#6B5845',
    divider: '#D4C3AB',
    hover: '#8B5E3C',
  };

  const darkPalette = {
    primary: '#E8D9C2',
    secondary: '#B7A48D',
    background: '#000000',
    paper: '#000000',
    textPrimary: '#F5EFE5',
    textSecondary: '#A89E91',
    divider: '#1A1A1A',
    hover: '#E8D9C2',
  };

  const colors = mode === 'light' ? lightPalette : darkPalette;

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        light: mode === 'light' ? '#9A6A46' : '#F1E5D2',
        dark: mode === 'light' ? '#60391D' : '#D1BFA7',
        contrastText: mode === 'light' ? '#fffaf2' : '#101010',
      },
      secondary: {
        main: colors.secondary,
        light: mode === 'light' ? '#CCA37F' : '#CCBCA7',
        dark: mode === 'light' ? '#9D6E44' : '#9E8B73',
      },
      background: {
        default: colors.background,
        paper: colors.paper,
      },
      text: {
        primary: colors.textPrimary,
        secondary: colors.textSecondary,
      },
      divider: colors.divider,
      action: {
        hover: alpha(colors.hover, mode === 'light' ? 0.12 : 0.1),
        selected: alpha(colors.hover, mode === 'light' ? 0.18 : 0.16),
      },
    },
    typography: {
      fontFamily:
        '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei","WenQuanYi Micro Hei",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 500, lineHeight: 1.5 },
      body1: { lineHeight: 1.6 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            color: colors.textPrimary,
            scrollbarColor: mode === 'light' ? '#A98D6F #E7DCC9' : '#585858 #000000',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { backgroundColor: mode === 'light' ? '#E7DCC9' : '#000000' },
            '&::-webkit-scrollbar-thumb': { 
                backgroundColor: mode === 'light' ? '#A98D6F' : '#585858',
                borderRadius: '4px',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            backgroundImage: 'none',
            boxShadow: mode === 'light' 
                ? '0 8px 20px rgba(66, 40, 16, 0.08)'
                : 'none',
            border: `1px solid ${mode === 'light' ? alpha('#C8B396', 0.8) : '#1A1A1A'}`,
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
              boxShadow: mode === 'light' ? `0 6px 14px ${alpha('#6B4C2F', 0.2)}` : 'none',
              transform: 'translateY(-1px)',
            },
          },
          containedPrimary: {
            background: mode === 'light' ? '#6F4527' : '#E8D9C2',
            color: mode === 'light' ? '#FFF8ED' : '#121212',
            '&:hover': {
              background: mode === 'light' ? '#5F3A20' : '#E1D1B8',
            },
          }
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
             boxShadow: mode === 'light'
                ? '0 2px 6px rgba(57, 34, 14, 0.05)'
                : 'none',
            border: `1px solid ${mode === 'light' ? alpha('#CCB79A', 0.65) : '#1A1A1A'}`,
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${mode === 'light' ? '#D7C7B2' : '#1A1A1A'}`,
            backdropFilter: 'blur(12px)',
            backgroundColor: mode === 'light' ? alpha('#F4E8D5', 0.88) : alpha('#000000', 0.92),
            color: colors.textPrimary,
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
                  borderColor: mode === 'light' ? '#BDA688' : '#2B2B2B',
              }
          }
      }
    },
  }), [colors.background, colors.divider, colors.hover, colors.paper, colors.primary, colors.secondary, colors.textPrimary, colors.textSecondary, mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
