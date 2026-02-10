import React, { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
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

// =============================================================================
// KOMA (コマ) DESIGN SYSTEM  —  MercuryDesk Manga UI
// =============================================================================
// Core metaphor: The UI IS a manga page.
//   - Every card is a PANEL (コマ)
//   - The background is PRINTED PAGE PAPER
//   - White gaps between cards are GUTTERS
//   - ONE border weight, ONE shadow depth, ONE texture
// =============================================================================

// 【SCREENTONE】 — The ONE texture, on page background only.
// 45° diagonal hatching lines, subtle. Cards stay clean/white.
export const screentoneLight = `
  repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 10px,
    rgba(0,0,0,0.025) 10px,
    rgba(0,0,0,0.025) 11px
  )
`;
export const screentoneDark = `
  repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 10px,
    rgba(255,255,255,0.03) 10px,
    rgba(255,255,255,0.03) 11px
  )
`;

// 【BOARD】: Main container fill
export const boardLight = `rgba(255,255,255,0.92)`;
export const boardDark = `rgba(20,20,20,0.92)`;

// =============================================================================
// PALETTE
// =============================================================================

const lightPalette = {
  primary: '#1A1A1A',
  secondary: '#1A1A1A',
  background: '#F2F0EB',       // Warm manga paper
  paper: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#555555',
  divider: '#1A1A1A',
  dividerLight: '#AAAAAA',     // For inner/subtle borders
  action: {
    active: '#1A1A1A',
    hover: 'rgba(0, 0, 0, 0.06)',
    selected: 'rgba(0, 0, 0, 0.10)',
  }
};

const darkPalette = {
  primary: '#E0E0E0',
  secondary: '#E0E0E0',
  background: '#0A0A0A',
  paper: '#141414',
  textPrimary: '#E0E0E0',
  textSecondary: '#999999',
  divider: '#E0E0E0',
  dividerLight: '#444444',
  action: {
    active: '#E0E0E0',
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: 'rgba(255, 255, 255, 0.12)',
  }
};

// =============================================================================
// PROVIDER
// =============================================================================

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

  const colors = mode === 'light' ? lightPalette : darkPalette;

  // KOMA Typography: Inter for everything — manga uses Gothic (sans-serif)
  const font = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  const canvasBg = mode === 'light' ? screentoneLight : screentoneDark;

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
      fontFamily: font,
      h1: { fontWeight: 900, letterSpacing: '-0.03em' },
      h2: { fontWeight: 900, letterSpacing: '-0.03em' },
      h3: { fontWeight: 900, letterSpacing: '-0.03em' },
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 800, letterSpacing: '-0.02em' },
      h6: { fontWeight: 800 },
      subtitle1: { fontWeight: 700 },
      subtitle2: { fontWeight: 700 },
      body1: { fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.6 },
      body2: { fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.55 },
      button: { fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.04em' },
      caption: { fontWeight: 500 },
      overline: { fontWeight: 800, letterSpacing: '0.12em' },
    },
    shape: { borderRadius: 0 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            backgroundImage: canvasBg,
            backgroundAttachment: 'fixed',
            color: colors.textPrimary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',          // Cards stay CLEAN — no texture
            backgroundColor: colors.paper,
            border: `2px solid ${colors.divider}`,
            boxShadow: `4px 4px 0 0 ${colors.textPrimary}`,
            borderRadius: 0,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          },
          elevation0: { boxShadow: 'none', border: 'none' },
          elevation1: { boxShadow: `2px 2px 0 0 ${colors.dividerLight}` },
          elevation2: { boxShadow: `4px 4px 0 0 ${colors.textPrimary}` },
          elevation3: { boxShadow: `6px 6px 0 0 ${colors.textPrimary}` },
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.primary}`,
            borderRadius: 0,
            boxShadow: `3px 3px 0 0 ${colors.dividerLight}`,
            fontWeight: 800,
            transition: 'all 0.12s ease',
            '&:hover': {
              transform: 'translate(-1px, -1px)',
              boxShadow: `5px 5px 0 0 ${colors.dividerLight}`,
              backgroundColor: colors.primary,
              color: mode === 'light' ? '#ffffff' : '#000000',
            },
            '&:active': {
              transform: 'translate(1px, 1px)',
              boxShadow: `1px 1px 0 0 ${colors.dividerLight}`,
            },
          },
          contained: {
            backgroundColor: colors.primary,
            color: mode === 'light' ? '#ffffff' : '#000000',
            '&:hover': {
              backgroundColor: colors.primary,
            }
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `4px 4px 0 0 ${colors.textPrimary}`,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            border: `1.5px solid ${colors.divider}`,
            fontWeight: 700,
            borderRadius: 0,
            boxShadow: `2px 2px 0 0 ${colors.dividerLight}`,
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `2px 2px 0 0 ${colors.dividerLight}`,
          }
        }
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              backgroundColor: colors.paper,
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
      MuiDivider: {
        styleOverrides: {
          root: {
            borderBottomWidth: '1px',
            borderColor: colors.dividerLight,
            opacity: 0.6,
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `2px 2px 0 0 ${colors.dividerLight}`,
          }
        }
      }
    },
  }), [canvasBg, colors, font, mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
