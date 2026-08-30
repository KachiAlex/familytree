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
            default: '#F1E6D2',
            paper: '#FFFDF9',
          },
          text: {
            primary: '#1C1410',
            secondary: '#5A5042',
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


