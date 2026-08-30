import React, { createContext, useMemo } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

export const ThemeModeContext = createContext({
  mode: 'light',
  toggleColorMode: () => {},
});

export const ThemeModeProvider = ({ children }) => {
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'light',
          primary: {
            main: '#22345E',
            light: '#3A4F82',
            pale: '#EAEEF6',
            contrastText: '#FFFFFF',
          },
          secondary: {
            main: '#C1622D',
            light: '#F7E5D8',
            dark: '#8a4a1e',
            contrastText: '#FFFFFF',
          },
          background: {
            default: '#FBF7F0',
            paper: '#FFFFFF',
          },
          text: {
            primary: '#1C1410',
            secondary: '#5C5346',
          },
          error: { main: '#C1622D' },
          warning: { main: '#D79A1E' },
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
          borderRadius: 16,
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                borderRadius: 16,
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 10,
                textTransform: 'none',
                fontWeight: 600,
              },
              contained: {
                boxShadow: '0 1px 2px rgba(34,52,94,.15), 0 8px 18px rgba(34,52,94,.18)',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(34,52,94,.2), 0 14px 26px rgba(34,52,94,.24)' },
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
    []
  );

  return (
    <ThemeModeContext.Provider value={{ mode: 'light', toggleColorMode: () => {} }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
};


