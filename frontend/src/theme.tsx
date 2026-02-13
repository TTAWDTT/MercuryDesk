
import React, { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

type ColorMode = 'light' | 'dark';

type ColorTokens = {
  bg: string;
  bgElevated: string;
  panel: string;
  panelAlt: string;
  text: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentSoft: string;
  danger: string;
};

interface ColorModeContextType {
  mode: ColorMode;
  toggleColorMode: () => void;
}

const ColorModeContext = createContext<ColorModeContextType>({
  mode: 'light',
  toggleColorMode: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

const lightTokens: ColorTokens = {
  bg: '#faf9f5',
  bgElevated: '#f3f1e8',
  panel: '#fffdf8',
  panelAlt: '#f5f3ea',
  text: '#141413',
  textMuted: '#7a786f',
  border: '#e8e6dc',
  borderStrong: '#d7d4c8',
  accent: '#111111',
  accentSoft: '#ececeb',
  danger: '#2b2b2a',
};

const darkTokens: ColorTokens = {
  bg: '#141413',
  bgElevated: '#1b1b19',
  panel: '#1d1d1b',
  panelAlt: '#252521',
  text: '#faf9f5',
  textMuted: '#b0aea5',
  border: '#34332f',
  borderStrong: '#4a4943',
  accent: '#f3f3f1',
  accentSoft: '#2b2b28',
  danger: '#d9d9d6',
};

export const boardLight = '#fffdf8';
export const boardDark = '#1d1d1b';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem('theme_mode');
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });

  const toggleColorMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme_mode', next);
      return next;
    });
  };

  const t = mode === 'light' ? lightTokens : darkTokens;
  const fontHeading = '"Poppins", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  const fontBody = '"Lora", "Noto Serif SC", "Songti SC", "STSong", serif';
  const fontMono = '"JetBrains Mono", "IBM Plex Mono", monospace';

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: t.accent,
            contrastText: '#f8fbff',
          },
          secondary: {
            main: mode === 'light' ? '#3b3b3a' : '#c9c9c6',
          },
          success: {
            main: '#788c5d',
          },
          error: {
            main: t.danger,
          },
          background: {
            default: t.bg,
            paper: t.panel,
          },
          text: {
            primary: t.text,
            secondary: t.textMuted,
          },
          divider: t.border,
        },
        typography: {
          fontFamily: fontBody,
          h1: { fontFamily: fontHeading, fontWeight: 700, letterSpacing: '-0.02em' },
          h2: { fontFamily: fontHeading, fontWeight: 700, letterSpacing: '-0.02em' },
          h3: { fontFamily: fontHeading, fontWeight: 700, letterSpacing: '-0.015em' },
          h4: { fontFamily: fontHeading, fontWeight: 700, letterSpacing: '-0.015em' },
          h5: { fontFamily: fontHeading, fontWeight: 650, letterSpacing: '-0.01em' },
          h6: { fontFamily: fontHeading, fontWeight: 650, letterSpacing: '-0.01em' },
          subtitle1: { fontFamily: fontHeading, fontWeight: 600 },
          subtitle2: { fontFamily: fontHeading, fontWeight: 600 },
          body1: { fontSize: '0.95rem', lineHeight: 1.62 },
          body2: { fontSize: '0.875rem', lineHeight: 1.56 },
          button: { fontFamily: fontHeading, fontWeight: 600, letterSpacing: '0.01em', textTransform: 'none' },
          caption: { fontSize: '0.78rem', lineHeight: 1.45 },
        },
        shape: {
          borderRadius: 10,
        },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              ':root': {
                '--md-select-bg': t.panel,
                '--md-select-fg': t.text,
                '--md-select-border': t.border,
              },
              body: {
                backgroundColor: t.bg,
                color: t.text,
                backgroundImage:
                  mode === 'light'
                    ? 'radial-gradient(circle at -10% -20%, rgba(20,20,19,0.08), transparent 32%)'
                    : 'radial-gradient(circle at -10% -20%, rgba(250,249,245,0.1), transparent 34%)',
                backgroundAttachment: 'fixed',
              },
              'select, option, optgroup': {
                backgroundColor: `${t.panel} !important`,
                color: `${t.text} !important`,
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                backgroundColor: t.panel,
                border: `1px solid ${t.border}`,
                boxShadow:
                  mode === 'light'
                    ? '0 6px 18px rgba(20,20,19,0.06)'
                    : '0 8px 20px rgba(0,0,0,0.24)',
                borderRadius: 12,
              },
              elevation0: {
                border: `1px solid ${t.border}`,
                boxShadow: 'none',
                backgroundColor: t.panel,
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                boxShadow:
                  mode === 'light'
                    ? '0 4px 14px rgba(20,20,19,0.06)'
                    : '0 6px 18px rgba(0,0,0,0.26)',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                borderBottom: `1px solid ${t.border}`,
                boxShadow: 'none',
                backdropFilter: 'blur(6px)',
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                borderWidth: 1,
                minHeight: 34,
                paddingInline: 14,
                fontFamily: fontHeading,
              },
              outlined: {
                borderColor: t.borderStrong,
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: 'none',
                },
              },
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                borderRadius: 999,
                border: `1px solid ${t.border}`,
                fontWeight: 600,
              },
            },
          },
          MuiAvatar: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                border: `1px solid ${t.border}`,
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 10,
                  backgroundColor: t.panel,
                  '& fieldset': {
                    borderColor: t.border,
                  },
                  '&:hover fieldset': {
                    borderColor: t.borderStrong,
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: t.accent,
                    borderWidth: 1,
                  },
                },
              },
            },
          },
          MuiSelect: {
            styleOverrides: {
              select: {
                borderRadius: 10,
                backgroundColor: t.panel,
              },
              icon: {
                color: t.textMuted,
              },
            },
          },
          MuiNativeSelect: {
            styleOverrides: {
              select: {
                borderRadius: 10,
                '& option': {
                  backgroundColor: t.panel,
                  color: t.text,
                  fontFamily: fontBody,
                },
              },
            },
          },
          MuiMenuItem: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                marginInline: 4,
                marginBlock: 2,
              },
            },
          },
          MuiTabs: {
            styleOverrides: {
              indicator: {
                height: 2,
                borderRadius: 2,
              },
            },
          },
          MuiTab: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                minHeight: 34,
                textTransform: 'none',
                fontWeight: 600,
                '&.Mui-selected': {
                  color: t.text,
                  backgroundColor: t.accentSoft,
                },
              },
            },
          },
          MuiDivider: {
            styleOverrides: {
              root: {
                borderColor: t.border,
              },
            },
          },
          MuiTooltip: {
            styleOverrides: {
              tooltip: {
                borderRadius: 8,
                border: `1px solid ${t.borderStrong}`,
                backgroundColor: t.panelAlt,
                color: t.text,
                fontSize: '0.75rem',
              },
              arrow: {
                color: t.panelAlt,
              },
            },
          },
          MuiSwitch: {
            styleOverrides: {
              track: {
                borderRadius: 999,
              },
            },
          },
        },
      }),
    [fontBody, fontHeading, mode, t]
  );

  return (
    <ColorModeContext.Provider value={{ mode, toggleColorMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
};
