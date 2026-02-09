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
    primary: '#d97757', // Anthropic Orange
    secondary: '#6a9bcc', // Anthropic Blue
    background: '#faf9f5', // Anthropic Light
    paper: '#ffffff',
    textPrimary: '#141413', // Anthropic Dark
    textSecondary: '#6e6d66',
    divider: '#e8e6dc', // Anthropic Light Gray
    hover: '#f0efe9',
    accentGreen: '#788c5d',
  };

  const darkPalette = {
    primary: '#e0886a', // Slightly lighter Orange for dark mode
    secondary: '#85b0db', // Slightly lighter Blue
    background: '#141413', // Anthropic Dark
    paper: '#1e1e1d',
    textPrimary: '#faf9f5', // Anthropic Light
    textSecondary: '#b0aea5', // Anthropic Mid Gray
    divider: '#2d2d2c',
    hover: '#2a2a29',
    accentGreen: '#8da36f',
  };

  const colors = mode === 'light' ? lightPalette : darkPalette;
  const headingFont = '"Poppins", "Noto Sans SC", sans-serif';
  const bodyFont = '"Lora", "Noto Serif SC", serif';

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        contrastText: '#faf9f5',
      },
      secondary: {
        main: colors.secondary,
        contrastText: '#faf9f5',
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
        hover: colors.hover,
        selected: alpha(colors.primary, 0.08),
      },
    },
    typography: {
      fontFamily: bodyFont,
      h1: { fontFamily: headingFont, fontWeight: 600, letterSpacing: '-0.02em', color: colors.textPrimary },
      h2: { fontFamily: headingFont, fontWeight: 600, letterSpacing: '-0.02em', color: colors.textPrimary },
      h3: { fontFamily: headingFont, fontWeight: 600, letterSpacing: '-0.02em', color: colors.textPrimary },
      h4: { fontFamily: headingFont, fontWeight: 500, letterSpacing: '-0.02em', color: colors.textPrimary },
      h5: { fontFamily: headingFont, fontWeight: 500, letterSpacing: '-0.01em', color: colors.textPrimary },
      h6: { fontFamily: headingFont, fontWeight: 500, letterSpacing: '-0.01em', color: colors.textPrimary },
      subtitle1: { fontFamily: headingFont, fontWeight: 500 },
      subtitle2: { fontFamily: headingFont, fontWeight: 500, letterSpacing: '0.01em' },
      body1: { fontFamily: bodyFont, lineHeight: 1.7, fontSize: '1.05rem' },
      body2: { fontFamily: bodyFont, lineHeight: 1.65 },
      button: { fontFamily: headingFont, fontWeight: 600, textTransform: 'none', letterSpacing: '0.02em' },
      overline: { fontFamily: headingFont, fontWeight: 600, letterSpacing: '0.08em' },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            color: colors.textPrimary,
            scrollbarColor: mode === 'light' ? '#b0aea5 #faf9f5' : '#3A4D73 #141413',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
                backgroundColor: mode === 'light' ? '#d1d0c9' : '#333',
                borderRadius: '4px',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: mode === 'light'
                ? '0 4px 12px rgba(20, 20, 19, 0.04)'
                : '0 4px 12px rgba(0, 0, 0, 0.2)',
            border: `1px solid ${colors.divider}`,
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '8px 20px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
              backgroundColor: alpha(colors.primary, 0.08),
            },
          },
          containedPrimary: {
            backgroundColor: colors.textPrimary, // Brand style: dark buttons
            color: colors.background,
            '&:hover': {
              backgroundColor: alpha(colors.textPrimary, 0.85),
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
          outlined: {
            borderColor: colors.divider,
            color: colors.textPrimary,
            '&:hover': {
              borderColor: colors.textPrimary,
              backgroundColor: 'transparent',
            }
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
               ? '0 2px 8px rgba(20, 20, 19, 0.04)'
               : '0 2px 8px rgba(0, 0, 0, 0.2)',
            border: `1px solid ${colors.divider}`,
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${colors.divider}`,
            backdropFilter: 'blur(16px)',
            backgroundColor: alpha(colors.background, 0.85),
            color: colors.textPrimary,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontFamily: headingFont,
            fontWeight: 500,
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: colors.background,
          }
        }
      }
    },
  }), [bodyFont, colors, headingFont, mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
