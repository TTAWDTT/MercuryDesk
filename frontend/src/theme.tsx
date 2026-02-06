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
    primary: '#4C8DFF',
    secondary: '#7AB2FF',
    background: '#F2F7FF',
    paper: '#F8FBFF',
    textPrimary: '#0E1B33',
    textSecondary: '#4F6282',
    divider: '#DCE6FA',
    hover: '#CFE1FF',
  };

  const darkPalette = {
    primary: '#4A7BEA',
    secondary: '#7CA6FF',
    background: '#000000',
    paper: '#000000',
    textPrimary: '#EAF1FF',
    textSecondary: '#98ABD1',
    divider: '#1A2742',
    hover: '#10203A',
  };

  const colors = mode === 'light' ? lightPalette : darkPalette;
  const headingFont =
    '"Poppins","Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Arial,sans-serif';
  const bodyFont =
    '"Lora","Noto Serif SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",Georgia,serif';

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        light: '#78A7FF',
        dark: '#2E63D8',
        contrastText: '#F7FBFF',
      },
      secondary: {
        main: colors.secondary,
        light: '#A5C8FF',
        dark: '#5A8DE6',
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
      fontFamily: bodyFont,
      h1: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.02em' },
      h2: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.02em' },
      h3: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontFamily: headingFont, fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontFamily: headingFont, fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontFamily: bodyFont, fontWeight: 500, lineHeight: 1.5 },
      body1: { fontFamily: bodyFont, lineHeight: 1.6 },
      body2: { fontFamily: bodyFont, lineHeight: 1.6 },
      button: { fontFamily: headingFont, fontWeight: 600, textTransform: 'none' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            color: colors.textPrimary,
            scrollbarColor: mode === 'light' ? '#9EB8E8 #EAF2FF' : '#3A4D73 #000000',
            '&::-webkit-scrollbar': { width: '8px' },
            '&::-webkit-scrollbar-track': { backgroundColor: mode === 'light' ? '#EAF2FF' : '#000000' },
            '&::-webkit-scrollbar-thumb': { 
                backgroundColor: mode === 'light' ? '#9EB8E8' : '#3A4D73',
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
                ? '0 8px 20px rgba(46, 99, 216, 0.08)'
                : '0 4px 14px rgba(0, 0, 0, 0.28)',
            border: `1px solid ${mode === 'light' ? alpha('#DCE6FA', 0.95) : '#1A2742'}`,
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
              boxShadow: mode === 'light' ? `0 6px 14px ${alpha('#3C74D9', 0.25)}` : 'none',
              transform: 'translateY(-1px)',
            },
          },
          containedPrimary: {
            background: mode === 'light' ? '#3F7DF0' : '#365FB5',
            color: '#F7FBFF',
            '&:hover': {
              background: mode === 'light' ? '#326BDD' : '#2E549F',
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
                ? '0 2px 8px rgba(46, 99, 216, 0.05)'
                : '0 3px 10px rgba(0, 0, 0, 0.2)',
            border: `1px solid ${mode === 'light' ? alpha('#DCE6FA', 0.95) : '#1A2742'}`,
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${mode === 'light' ? '#DCE6FA' : '#1A2742'}`,
            backdropFilter: 'blur(12px)',
            backgroundColor: mode === 'light' ? alpha('#F8FBFF', 0.9) : alpha('#000000', 0.94),
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
                  borderColor: mode === 'light' ? '#C9DDFE' : '#2A3D60',
              }
          }
      }
    },
  }), [bodyFont, colors.background, colors.divider, colors.hover, colors.paper, colors.primary, colors.secondary, colors.textPrimary, colors.textSecondary, headingFont, mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
