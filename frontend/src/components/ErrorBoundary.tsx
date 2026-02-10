import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          minHeight="100vh"
          bgcolor="background.default"
          p={3}
        >
          <Paper
            elevation={0}
            sx={{
              p: 4,
              maxWidth: 480,
              border: '3px solid',
              borderColor: 'text.primary',
              borderRadius: 0,
              boxShadow: (t: any) => `6px 6px 0 0 ${t.palette.text.primary}`,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" fontWeight={900} gutterBottom>
              页面出错了
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, wordBreak: 'break-word' }}>
              {this.state.error?.message || '发生了未知错误'}
            </Typography>
            <Box display="flex" gap={2} justifyContent="center">
              <Button variant="outlined" onClick={this.handleReset} sx={{ borderRadius: 0, fontWeight: 700 }}>
                重试
              </Button>
              <Button variant="contained" onClick={this.handleReload} sx={{ borderRadius: 0, fontWeight: 700 }}>
                刷新页面
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}
