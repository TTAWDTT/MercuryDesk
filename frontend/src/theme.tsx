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

// =============================================================================
// MANGA TEXTURE ASSETS (POP ART / HALFTONE REVISION)
// =============================================================================

// 【CANVAS】: Global Background
// Concept: "Pop Art Dots" - Large, distinct halftone pattern.
// High artistic style, reminiscent of Roy Lichtenstein.
export const canvasLight = `
  radial-gradient(circle, #D1D5DB 2px, transparent 2.5px)
`;
export const canvasDark = `
  radial-gradient(circle, #4B5563 2px, transparent 2.5px)
`;

// 【HEADER】: Top Bar
// Concept: "Solid Ink Block" - Pure black/white contrast for maximum impact.
// We use a linear gradient to simulate a solid block that still works with backgroundImage prop.
export const headerLight = `linear-gradient(to bottom, #000000, #000000)`;
export const headerDark = `linear-gradient(to bottom, #ffffff, #ffffff)`;

// 【CARD_BG】: Card Interior
// Concept: "Clean Canvas" - Subtle diagonal lines for texture without noise.
// Much cleaner than the previous "dirty" noise.
export const cardBgLight = `
  repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(0,0,0,0.03) 10px,
    rgba(0,0,0,0.03) 11px
  )
`;
export const cardBgDark = `
  repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(255,255,255,0.03) 10px,
    rgba(255,255,255,0.03) 11px
  )
`;

// 【BOARD】: Container Background
export const boardLight = `rgba(255,255,255,0.9)`;
export const boardDark = `rgba(0,0,0,0.9)`;

// Legacy exports
export const heavyComicLight = canvasLight;
export const heavyComicDark = canvasDark;
export const crossHatchLight = cardBgLight;
export const crossHatchDark = cardBgDark;

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

  // High Contrast Pop-Manga Palette
  const lightPalette = {
    primary: '#000000',
    secondary: '#000000',
    background: '#F3F4F6', // Light gray to make white cards pop
    paper: '#ffffff',
    textPrimary: '#000000',
    textSecondary: '#4B5563',
    divider: '#000000',
    action: {
        active: '#000000',
        hover: 'rgba(0, 0, 0, 0.08)',
        selected: 'rgba(0, 0, 0, 0.12)',
    }
  };

  const darkPalette = {
    primary: '#ffffff',
    secondary: '#ffffff',
    background: '#111827', // Dark gray
    paper: '#000000',
    textPrimary: '#ffffff',
    textSecondary: '#9CA3AF',
    divider: '#ffffff',
    action: {
        active: '#ffffff',
        hover: 'rgba(255, 255, 255, 0.15)',
        selected: 'rgba(255, 255, 255, 0.25)',
    }
  };

  const colors = mode === 'light' ? lightPalette : darkPalette;

  // Artistic Typography: "International Style"
  // Strong, Geometric Sans-Serif headers + Mono body
  const headingFont = '"Inter", "Roboto", "Helvetica Neue", Arial, sans-serif';
  const bodyFont = '"JetBrains Mono", "Fira Code", "Consolas", monospace';

  const canvasBg = mode === 'light' ? canvasLight : canvasDark;
  const activePaperBg = mode === 'light' ? cardBgLight : cardBgDark;

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
      h1: { fontFamily: headingFont, fontWeight: 900, letterSpacing: '-0.03em' },
      h2: { fontFamily: headingFont, fontWeight: 900, letterSpacing: '-0.03em' },
      h3: { fontFamily: headingFont, fontWeight: 900, letterSpacing: '-0.03em' },
      h4: { fontFamily: headingFont, fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontFamily: headingFont, fontWeight: 800, letterSpacing: '-0.02em' },
      h6: { fontFamily: headingFont, fontWeight: 800 },
      subtitle1: { fontFamily: headingFont, fontWeight: 700 },
      subtitle2: { fontFamily: headingFont, fontWeight: 700 },
      body1: { fontFamily: bodyFont, fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.6 },
      body2: { fontFamily: bodyFont, fontWeight: 500, fontSize: '0.875rem' },
      button: { fontFamily: headingFont, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' },
      caption: { fontFamily: bodyFont, fontWeight: 500 },
      overline: { fontFamily: headingFont, fontWeight: 800, letterSpacing: '0.1em' },
    },
    shape: { borderRadius: 0 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background,
            backgroundImage: canvasBg, // 【CANVAS】
            backgroundSize: '24px 24px', // Consistent Pop Art Grid
            backgroundAttachment: 'fixed',
            color: colors.textPrimary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: activePaperBg, // 【CARD_BG】
            backgroundColor: colors.paper, // Ensure solid background so we don't see body dots through cards
            backgroundSize: 'auto',
            border: `2px solid ${colors.divider}`,
            // Pop Art Shadow: Deep, solid, sharp
            boxShadow: `8px 8px 0 0 ${colors.textPrimary}`,
            borderRadius: 0,
            transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          elevation0: { boxShadow: 'none' }, // Allow overrides
          elevation1: { boxShadow: `6px 6px 0 0 ${colors.divider}` },
          elevation2: { boxShadow: `8px 8px 0 0 ${colors.divider}` },
          elevation3: { boxShadow: `12px 12px 0 0 ${colors.divider}` },
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.primary}`,
            borderRadius: 0,
            boxShadow: `4px 4px 0 0 ${colors.primary}`,
            fontWeight: 800,
            '&:hover': {
              transform: 'translate(-1px, -1px)',
              boxShadow: `6px 6px 0 0 ${colors.primary}`,
              backgroundColor: colors.primary,
              color: mode === 'light' ? '#ffffff' : '#000000',
            },
            '&:active': {
              transform: 'translate(2px, 2px)',
              boxShadow: `2px 2px 0 0 ${colors.primary}`,
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
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `8px 8px 0 0 ${colors.divider}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            fontWeight: 700,
            borderRadius: 0,
            boxShadow: `3px 3px 0 0 ${colors.divider}`,
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `3px 3px 0 0 ${colors.divider}`,
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
            borderBottomWidth: '2px',
            borderColor: colors.divider,
            opacity: 0.2,
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `5px 5px 0 0 ${colors.divider}`,
          }
        }
      }
    },
  }), [activePaperBg, bodyFont, canvasBg, colors, headingFont, mode]);

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
