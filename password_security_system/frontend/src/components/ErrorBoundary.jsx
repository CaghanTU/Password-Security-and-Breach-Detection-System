import { Component } from 'react'
import { Box, Paper, Typography, Button } from '@mui/material'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <Paper sx={{ maxWidth: 600, p: 4, border: '1px solid', borderColor: 'error.main' }}>
            <Typography variant="h5" color="error" gutterBottom>Application Error</Typography>
            <Typography
              component="pre"
              variant="body2"
              color="warning.main"
              sx={{ mt: 2, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
            >
              {this.state.error.toString()}
              {'\n\n'}
              {this.state.error.stack}
            </Typography>
            <Button variant="outlined" color="error" sx={{ mt: 3 }} onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Paper>
        </Box>
      )
    }
    return this.props.children
  }
}
