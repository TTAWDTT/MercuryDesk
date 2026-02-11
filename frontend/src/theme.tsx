
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
  bg: '#f6f7f8',
  bgElevated: '#eef2f5',
  panel: '#ffffff',
  panelAlt: '#f9fbfc',
  text: '#111418',
  textMuted: '#5b6470',
  border: '#d7dde3',
  borderStrong: '#c3ccd5',
  accent: '#0f766e',
  accentSoft: '#d6f3ef',
  danger: '#b45309',
};

const darkTokens: ColorTokens = {
  bg: '#0f1317',
  bgElevated: '#151b22',
  panel: '#1b222b',
  panelAlt: '#222b35',
  text: '#ecf1f6',
  textMuted: '#9eadbb',
  border: '#354251',
  borderStrong: '#445567',
  accent: '#3bc6ba',
  accentSoft: '#1f4b48',
  danger: '#f5a75f',
};

export const boardLight = '#ffffff';
export const boardDark = '#1b222b';

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
  const fontHeading = '"IBM Plex Sans", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  const fontBody = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';
  const fontMono = '"IBM Plex Mono", "JetBrains Mono", monospace';

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: t.accent,
            contrastText: mode === 'light' ? '#ffffff' : '#062a28',
          },
          secondary: {
            main: mode === 'light' ? '#3b4756' : '#c6d2de',
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
                    ? 'radial-gradient(circle at 15% -20%, rgba(15,118,110,0.08), transparent 28%), radial-gradient(circle at 110% 0%, rgba(58,125,199,0.08), transparent 32%)'
                    : 'radial-gradient(circle at 12% -18%, rgba(59,198,186,0.16), transparent 30%), radial-gradient(circle at 112% 0%, rgba(105,147,255,0.14), transparent 35%)',
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
                    ? '0 8px 24px rgba(17,20,24,0.08)'
                    : '0 10px 28px rgba(0,0,0,0.32)',
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
                    ? '0 6px 18px rgba(17,20,24,0.08)'
                    : '0 8px 24px rgba(0,0,0,0.34)',
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: 'none',
                borderBottom: `1px solid ${t.border}`,
                boxShadow: 'none',
                backdropFilter: 'blur(10px)',
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
