import { alpha, createTheme } from '@mui/material/styles'

const palette = {
  mode: 'dark',
  primary: { main: '#63d8cc', light: '#92f0e6', dark: '#1d8d84' },
  secondary: { main: '#f1bf66', light: '#ffd99a', dark: '#b67f1c' },
  error: { main: '#ff6b5a' },
  warning: { main: '#f0a847' },
  success: { main: '#5ec68b' },
  info: { main: '#67b7ff' },
  background: {
    default: '#071117',
    paper: '#0d1820',
  },
  text: {
    primary: '#f4f7fb',
    secondary: '#94a4b8',
  },
  divider: alpha('#c8f5ef', 0.12),
}

export const theme = createTheme({
  palette,
  shape: {
    borderRadius: 6,
  },
  typography: {
    fontFamily: '"Avenir Next", "Segoe UI Variable", "Segoe UI", sans-serif',
    h3: { fontWeight: 800, letterSpacing: '-0.03em' },
    h4: { fontWeight: 800, letterSpacing: '-0.03em' },
    h5: { fontWeight: 800, letterSpacing: '-0.025em' },
    h6: { fontWeight: 700, letterSpacing: '-0.02em' },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': {
          colorScheme: 'dark',
        },
        body: {
          minHeight: '100vh',
          backgroundColor: palette.background.default,
          backgroundImage: [
            'radial-gradient(circle at 12% 20%, rgba(99, 216, 204, 0.14), transparent 28%)',
            'radial-gradient(circle at 88% 12%, rgba(241, 191, 102, 0.12), transparent 24%)',
            'linear-gradient(180deg, #09131a 0%, #071117 44%, #050d13 100%)',
          ].join(','),
          color: palette.text.primary,
        },
        '#root': {
          minHeight: '100vh',
        },
        '::selection': {
          backgroundColor: alpha(palette.primary.main, 0.3),
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: alpha(palette.background.paper, 0.94),
          border: `1px solid ${alpha(palette.primary.light, 0.1)}`,
          boxShadow: '0 24px 80px rgba(3, 8, 12, 0.35)',
          backdropFilter: 'blur(16px)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(180deg, rgba(15, 25, 33, 0.96) 0%, rgba(10, 18, 24, 0.98) 100%)',
          border: `1px solid ${alpha(palette.primary.light, 0.1)}`,
          boxShadow: '0 18px 50px rgba(3, 8, 12, 0.28)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 18,
          minHeight: 42,
          letterSpacing: '0.01em',
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #63d8cc 0%, #25998f 100%)',
          color: '#061015',
        },
        containedSuccess: {
          background: 'linear-gradient(135deg, #7fdb99 0%, #3d9f64 100%)',
        },
        outlined: {
          borderColor: alpha(palette.primary.main, 0.24),
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 700,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          display: 'none',
        },
        flexContainer: {
          gap: 8,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 42,
          borderRadius: 999,
          padding: '10px 16px',
          color: palette.text.secondary,
          transition: 'background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease',
          border: `1px solid ${alpha('#ffffff', 0.06)}`,
          '&.Mui-selected': {
            color: palette.text.primary,
            backgroundColor: alpha('#ffffff', 0.06),
            borderColor: alpha(palette.primary.main, 0.18),
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: alpha('#ffffff', 0.02),
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#ffffff', 0.1),
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(palette.primary.main, 0.35),
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(palette.primary.main, 0.65),
            borderWidth: 1,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${alpha('#ffffff', 0.08)}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 24,
        },
      },
    },
  },
})
