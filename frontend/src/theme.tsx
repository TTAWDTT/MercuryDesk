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
// MANGA TEXTURE ASSETS — HALFTONE / CROSS-HATCH / SPEED-LINE
// =============================================================================

// 【CANVAS】: Global Background
// Concept: "Ben-Day Dots" — The signature halftone dot pattern of printed manga
// and Roy Lichtenstein pop art. Immediately signals "comic book page".
export const canvasLight = `
  radial-gradient(circle, rgba(0,0,0,0.07) 1px, transparent 1px)
`;
export const canvasDark = `
  radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)
`;

// 【HEADER】: Top Bar
// Concept: "Speed Lines" — Horizontal lines rushing across the header bar,
// evoking manga action panels and the flow of incoming messages.
export const headerLight = `
  repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(255,255,255,0.04) 3px,
    rgba(255,255,255,0.04) 4px
  )
`;
export const headerDark = `
  repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0,0,0,0.06) 3px,
    rgba(0,0,0,0.06) 4px
  )
`;

// 【CARD_BG】: Card Interior
// Concept: "Cross-Hatch" — Two-directional diagonal lines overlaid,
// the classic manga shading technique for indicating tone/depth.
export const cardBgLight = `
  repeating-linear-gradient(
    45deg,
    transparent,
    transparent 7px,
    rgba(0,0,0,0.035) 7px,
    rgba(0,0,0,0.035) 8px
  ),
  repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 7px,
    rgba(0,0,0,0.035) 7px,
    rgba(0,0,0,0.035) 8px
  )
`;
export const cardBgDark = `
  repeating-linear-gradient(
    45deg,
    transparent,
    transparent 7px,
    rgba(255,255,255,0.035) 7px,
    rgba(255,255,255,0.035) 8px
  ),
  repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 7px,
    rgba(255,255,255,0.035) 7px,
    rgba(255,255,255,0.035) 8px
  )
`;

// 【BOARD】: Container Background
export const boardLight = `rgba(255,255,255,0.9)`;
export const boardDark = `rgba(0,0,0,0.9)`;

// High Contrast Pop-Manga Palette (defined outside component for referential stability)
const lightPalette = {
  primary: '#000000',
  secondary: '#000000',
  background: '#F3F4F6',
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
  background: '#111827',
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
      body1: { fontFamily: bodyFont, fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.75 },
      body2: { fontFamily: bodyFont, fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.7 },
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
            backgroundImage: canvasBg, // 【CANVAS】Ben-Day Dots
            backgroundSize: '14px 14px', // Halftone dot spacing
            backgroundAttachment: 'fixed',
            color: colors.textPrimary,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: activePaperBg, // 【CARD_BG】Cross-Hatch
            backgroundColor: colors.paper,
            backgroundSize: 'auto',
            border: `2px solid ${colors.divider}`,
            // Three-tier shadow system: 墨点(2) / 墨线(4) / 墨块(8)
            boxShadow: `4px 4px 0 0 ${colors.textPrimary}`,
            borderRadius: 0,
            transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          elevation0: { boxShadow: 'none' },
          elevation1: { boxShadow: `2px 2px 0 0 ${colors.divider}` },   // 墨点
          elevation2: { boxShadow: `4px 4px 0 0 ${colors.divider}` },   // 墨线
          elevation3: { boxShadow: `8px 8px 0 0 ${colors.divider}` },   // 墨块
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.primary}`,
            borderRadius: 0,
            boxShadow: `3px 3px 0 0 ${colors.primary}`,
            fontWeight: 800,
            transition: 'all 0.12s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translate(-1px, -1px)',
              boxShadow: `5px 5px 0 0 ${colors.primary}`,
              backgroundColor: colors.primary,
              color: mode === 'light' ? '#ffffff' : '#000000',
            },
            '&:active': {
              transform: 'translate(2px, 2px) scale(0.98)',
              boxShadow: `1px 1px 0 0 ${colors.primary}`,
              transition: 'all 0.06s cubic-bezier(0.4, 0, 0.2, 1)',
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
            boxShadow: `4px 4px 0 0 ${colors.divider}`,  // 墨线 level
            transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            border: `1.5px solid ${colors.divider}`,
            fontWeight: 700,
            borderRadius: 0,
            boxShadow: `2px 2px 0 0 ${colors.divider}`,  // 墨点 level
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `2px 2px 0 0 ${colors.divider}`,  // 墨点 level
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
            borderStyle: 'dashed',
            borderColor: colors.divider,
            opacity: 0.25,
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            border: `2px solid ${colors.divider}`,
            borderRadius: 0,
            boxShadow: `3px 3px 0 0 ${colors.divider}`,  // 墨点~墨线
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
