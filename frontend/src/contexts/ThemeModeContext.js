import React, { createContext, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

export const ThemeModeContext = createContext({
  mode: 'light',
  toggleColorMode: () => {},
});

const getInitialMode = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('themeMode');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

export const ThemeModeProvider = ({ children }) => {
  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    localStorage.setItem('themeMode', mode);
  }, [mode]);

  const toggleColorMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#B8541F',
            light: '#F4E0D2',
            dark: '#8a3d15',
            contrastText: '#FFFDF9',
          },
          secondary: {
            main: '#22345E',
            light: '#3A4F82',
            pale: '#E8ECF4',
            contrastText: '#FFFDF9',
          },
          background: {
            default: mode === 'light' ? '#F1E6D2' : '#1C1410',
            paper: mode === 'light' ? '#FFFDF9' : '#2A2018',
          },
          text: {
            primary: mode === 'light' ? '#1C1410' : '#F1E6D2',
            secondary: mode === 'light' ? '#5A5042' : '#9C8D77',
          },
          error: { main: '#B8541F' },
          warning: { main: '#C7930A' },
          success: { main: '#3F6644' },
          info: { main: '#22345E' },
        },
        typography: {
          fontFamily: "'Work Sans', sans-serif",
          h1: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
          h2: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
          h3: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
          h4: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
          h5: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
          h6: { fontFamily: "'Fraunces', serif", fontWeight: 600 },
          button: { textTransform: 'none', fontWeight: 600 },
          overline: { fontFamily: "'IBM Plex Mono', monospace", fontSize: '12px', letterSpacing: '0.08em' },
        },
        shape: {
          borderRadius: 14,
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 14,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 9,
                textTransform: 'none',
                fontWeight: 600,
              },
              contained: {
                boxShadow: '0 3px 0 0 #8a3d15',
                '&:hover': { boxShadow: '0 4px 0 0 #8a3d15', transform: 'translateY(-1px)' },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                fontFamily: "'IBM Plex Mono', monospace",
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                boxShadow: 'none',
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeModeContext.Provider value={{ mode, toggleColorMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};


