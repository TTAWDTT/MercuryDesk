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
  const lightPalette = {
    primary: '#000000',
    secondary: '#000000',
    // Back to Pure White as requested, but we will add heavy texture
    background: '#ffffff',
    paper: '#ffffff',
    textPrimary: '#000000',
    textSecondary: '#000000',
    divider: '#000000',
    action: {
        active: '#000000',
        hover: 'rgba(0, 0, 0, 0.04)',
        selected: 'rgba(0, 0, 0, 0.08)',
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
  const bodyFont = '"Courier New", Courier, monospace';

  // Hatching Patterns - CHAOTIC / SKETCHY
  // Layering multiple gradients with different angles and spacing to create visual complexity
  const chaoticHatchLight = `
    repeating-linear-gradient(45deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 5px),
    repeating-linear-gradient(115deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 17px),
    repeating-linear-gradient(-25deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 11px)
  `;
  const chaoticHatchDark = `
    repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 5px),
    repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 17px),
    repeating-linear-gradient(-25deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 11px)
  `;
  const hatchingBg = mode === 'light' ? chaoticHatchLight : chaoticHatchDark;

  // Cross-hatching for interaction states
  const crossHatchLight = `
    repeating-linear-gradient(45deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px),
    repeating-linear-gradient(-45deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)
  `;
  const crossHatchDark = `
    repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 3px),
    repeating-linear-gradient(-45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 3px)
  `;
  const activeHatch = mode === 'light' ? crossHatchLight : crossHatchDark;

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
      h1: { fontFamily: headingFont, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' },
      h2: { fontFamily: headingFont, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' },
      h3: { fontFamily: headingFont, fontWeight: 900, letterSpacing: '0.05em', textTransform: 'uppercase' },
      h4: { fontFamily: headingFont, fontWeight: 800, letterSpacing: '0.02em' },
      h5: { fontFamily: headingFont, fontWeight: 800 },
      h6: { fontFamily: headingFont, fontWeight: 800 },
      subtitle1: { fontFamily: headingFont, fontWeight: 700 },
      subtitle2: { fontFamily: headingFont, fontWeight: 700 },
      body1: { fontFamily: bodyFont, fontWeight: 600, lineHeight: 1.6 },
      body2: { fontFamily: bodyFont, fontWeight: 600 },
      button: { fontFamily: headingFont, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' },
      caption: { fontFamily: bodyFont, fontWeight: 600 },
      overline: { fontFamily: headingFont, fontWeight: 800 },
    },
    shape: { borderRadius: 0 }, // Strict Square
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            backgroundImage: hatchingBg, // Global Dense Hatching
            backgroundAttachment: 'fixed',
            color: colors.textPrimary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `3px solid ${colors.divider}`,
            boxShadow: '6px 6px 0 0 rgba(0,0,0,1)',
            borderRadius: 0,
          },
          elevation1: { boxShadow: `6px 6px 0 0 ${colors.divider}` },
          elevation2: { boxShadow: `8px 8px 0 0 ${colors.divider}` },
          elevation3: { boxShadow: `10px 10px 0 0 ${colors.divider}` },
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            border: `3px solid ${colors.primary}`,
            borderRadius: 0,
            boxShadow: `4px 4px 0 0 ${colors.primary}`,
            textTransform: 'none',
            fontWeight: 800,
            '&:hover': {
              transform: 'translate(-1px, -1px)',
              boxShadow: `6px 6px 0 0 ${colors.primary}`,
              backgroundColor: 'transparent',
              backgroundImage: activeHatch, // Cross-hatching on hover
            },
            '&:active': {
              transform: 'translate(2px, 2px)',
              boxShadow: '2px 2px 0 0 ${colors.primary}',
            },
          },
          contained: {
            backgroundColor: colors.primary,
            color: mode === 'light' ? '#ffffff' : '#000000',
            boxShadow: `4px 4px 0 0 ${colors.textPrimary}`,
            '&:hover': {
               backgroundColor: colors.primary,
               boxShadow: `6px 6px 0 0 ${colors.textPrimary}`,
               backgroundImage: 'none',
            }
          },
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
            backgroundColor: colors.background,
            fontWeight: 800,
            borderRadius: 0,
            boxShadow: `3px 3px 0 0 ${colors.divider}`,
          },
          filled: {
            backgroundImage: hatchingBg,
            backgroundColor: 'transparent',
          }
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            backgroundColor: colors.background,
            color: colors.textPrimary,
            borderRadius: 0,
          }
        }
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              backgroundColor: colors.background,
              '& fieldset': {
                borderWidth: '3px',
                borderColor: colors.divider,
              },
              '&:hover fieldset': {
                borderWidth: '3px',
                borderColor: colors.textPrimary,
              },
              '&.Mui-focused fieldset': {
                borderWidth: '3px',
                borderColor: colors.textPrimary,
                boxShadow: `6px 6px 0 0 ${colors.textPrimary}`,
              },
            },
          }
        }
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderLeft: `4px solid ${colors.divider}`,
          }
        }
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderBottomWidth: '3px',
            borderColor: colors.divider,
            borderStyle: 'solid',
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            border: `3px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `6px 6px 0 0 ${colors.divider}`,
            backgroundImage: hatchingBg,
          },
          standardInfo: { backgroundColor: colors.background, color: colors.textPrimary },
          standardSuccess: { backgroundColor: colors.background, color: colors.textPrimary },
          standardWarning: { backgroundColor: colors.background, color: colors.textPrimary },
          standardError: { backgroundColor: colors.background, color: colors.textPrimary }
        }
      }
    },
  }), [activeHatch, bodyFont, colors, hatchingBg, headingFont, mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
