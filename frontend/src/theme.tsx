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

  // Manga / Comic Style Palette
  // Strictly Black & White with hard contrasts
  const lightPalette = {
    primary: '#000000',
    secondary: '#000000',
    background: '#ffffff',
    paper: '#ffffff',
    textPrimary: '#000000',
    textSecondary: '#000000', // No grey, just black
    divider: '#000000',
    action: {
        active: '#000000',
        hover: 'rgba(0, 0, 0, 0.05)',
        selected: 'rgba(0, 0, 0, 0.1)',
    }
  };

  const darkPalette = {
    primary: '#ffffff',
    secondary: '#ffffff',
    background: '#000000',
    paper: '#000000',
    textPrimary: '#ffffff',
    textSecondary: '#ffffff',
    divider: '#ffffff',
    action: {
        active: '#ffffff',
        hover: 'rgba(255, 255, 255, 0.1)',
        selected: 'rgba(255, 255, 255, 0.2)',
    }
  };

  const colors = mode === 'light' ? lightPalette : darkPalette;

  // Comic fonts
  const headingFont = '"Comic Sans MS", "Chalkboard SE", "Marker Felt", sans-serif';
  const bodyFont = '"Courier New", Courier, monospace'; // Typewriter style for body

  const theme = useMemo(() => createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        contrastText: mode === 'light' ? '#ffffff' : '#000000',
      },
      secondary: {
        main: colors.secondary,
        contrastText: mode === 'light' ? '#ffffff' : '#000000',
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
      action: colors.action,
    },
    typography: {
      fontFamily: bodyFont,
      h1: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
      h2: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
      h3: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' },
      h4: { fontFamily: headingFont, fontWeight: 700, letterSpacing: '0.02em' },
      h5: { fontFamily: headingFont, fontWeight: 700 },
      h6: { fontFamily: headingFont, fontWeight: 700 },
      subtitle1: { fontFamily: headingFont, fontWeight: 600 },
      subtitle2: { fontFamily: headingFont, fontWeight: 600 },
      body1: { fontFamily: bodyFont, fontWeight: 500, lineHeight: 1.6 },
      body2: { fontFamily: bodyFont, fontWeight: 500 },
      button: { fontFamily: headingFont, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' },
      caption: { fontFamily: bodyFont, fontWeight: 500 },
      overline: { fontFamily: headingFont, fontWeight: 700 },
    },
    shape: { borderRadius: 0 }, // Sharp corners for everything
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            backgroundImage: mode === 'light'
                ? 'radial-gradient(#000000 1px, transparent 1px)'
                : 'radial-gradient(#333333 1px, transparent 1px)',
            backgroundSize: '20px 20px', // Halftone dot pattern
            color: colors.textPrimary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `2px solid ${colors.divider}`,
            boxShadow: '4px 4px 0 0 rgba(0,0,0,1)', // Hard shadow
          },
          elevation1: {
            boxShadow: `4px 4px 0 0 ${colors.divider}`,
          },
          elevation2: {
            boxShadow: `6px 6px 0 0 ${colors.divider}`,
          },
          elevation3: {
            boxShadow: `8px 8px 0 0 ${colors.divider}`,
          },
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.primary}`,
            boxShadow: `2px 2px 0 0 ${colors.primary}`,
            '&:hover': {
              transform: 'translate(-1px, -1px)',
              boxShadow: `4px 4px 0 0 ${colors.primary}`,
              backgroundColor: 'transparent',
            },
            '&:active': {
              transform: 'translate(2px, 2px)',
              boxShadow: 'none',
            },
          },
          contained: {
            backgroundColor: colors.primary,
            color: mode === 'light' ? '#ffffff' : '#000000',
            boxShadow: `4px 4px 0 0 ${colors.textPrimary}`,
            '&:hover': {
               backgroundColor: colors.primary,
               boxShadow: `6px 6px 0 0 ${colors.textPrimary}`,
            }
          },
          outlined: {
            borderWidth: '2px',
            '&:hover': {
                borderWidth: '2px',
            }
          }
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            border: `3px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `8px 8px 0 0 ${colors.divider}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            backgroundColor: 'transparent',
            fontWeight: 700,
            boxShadow: `2px 2px 0 0 ${colors.divider}`,
          },
          filled: {
            backgroundColor: colors.action.hover,
          }
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            backgroundColor: 'transparent',
            color: colors.textPrimary,
          }
        }
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              '& fieldset': {
                borderWidth: '2px',
                borderColor: colors.divider,
              },
              '&:hover fieldset': {
                borderWidth: '2px',
                borderColor: colors.textPrimary,
              },
              '&.Mui-focused fieldset': {
                borderWidth: '2px',
                borderColor: colors.textPrimary,
                boxShadow: `4px 4px 0 0 ${colors.textPrimary}`,
              },
            },
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderLeft: `3px solid ${colors.divider}`,
          }
        }
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderBottomWidth: '2px',
            borderColor: colors.divider,
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `4px 4px 0 0 ${colors.divider}`,
          },
          standardInfo: {
             backgroundColor: 'transparent',
             color: colors.textPrimary,
          },
          standardSuccess: {
             backgroundColor: 'transparent',
             color: colors.textPrimary,
          },
          standardWarning: {
             backgroundColor: 'transparent',
             color: colors.textPrimary,
          },
          standardError: {
             backgroundColor: 'transparent',
             color: colors.textPrimary,
          }
        }
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `2px solid ${colors.divider}`,
            fontFamily: bodyFont,
          },
          head: {
            fontFamily: headingFont,
            fontWeight: 700,
            borderBottom: `3px solid ${colors.divider}`,
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
