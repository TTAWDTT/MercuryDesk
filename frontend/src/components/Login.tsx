import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ApiError, login, register, setToken } from '../api';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import InputAdornment from '@mui/material/InputAdornment';
import EmailIcon from '@mui/icons-material/EmailOutlined';
import LockIcon from '@mui/icons-material/LockOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { alpha, useTheme } from '@mui/material/styles';

export default function Login(props: { onAuthed: () => void }) {
  const theme = useTheme();
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.length > 3 && password.length >= 8 && !busy, [email, password, busy]);

  async function onLogin() {
    setBusy(true);
    setError(null);
    try {
      const token = await login(email, password);
      setToken(token.access_token);
      props.onAuthed();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError('邮箱或密码不正确');
      else setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRegisterAndLogin() {
    setBusy(true);
    setError(null);
    try {
      await register(email, password);
      await onLogin();
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) setError('该邮箱已注册');
      else setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(circle at 50% 50%, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${theme.palette.background.default} 50%)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background elements */}
      <Box 
        component={motion.div}
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: [0, 90, 0],
          opacity: [0.3, 0.5, 0.3] 
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        sx={{
          position: 'absolute',
          top: '-10%',
          right: '-5%',
          width: '500px',
          height: '500px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.2)} 0%, transparent 70%)`,
          filter: 'blur(60px)',
          zIndex: 0,
        }} 
      />
      
      <Container maxWidth="xs" sx={{ zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <Paper 
            elevation={0} 
            sx={{ 
              p: 5, 
              width: '100%', 
              borderRadius: 4,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
              backdropFilter: 'blur(20px)',
              background: alpha(theme.palette.background.paper, 0.8),
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)',
            }}
          >
            <Box textAlign="center" mb={4}>
              <Box 
                sx={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: 3, 
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  margin: '0 auto 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '24px'
                }}
              >
                M
              </Box>
              <Typography variant="h4" fontWeight="800" color="textPrimary" gutterBottom>
                MercuryDesk
              </Typography>
              <Typography variant="body1" color="textSecondary">
                统一收件箱（按发信人聚合）。
              </Typography>
            </Box>

            <Stack spacing={3}>
              <TextField
                label="邮箱"
                variant="outlined"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="密码"
                type="password"
                variant="outlined"
                fullWidth
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                }}
              />

              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
                </motion.div>
              )}

              <Button 
                variant="contained" 
                color="primary" 
                fullWidth 
                size="large"
                disabled={!canSubmit}
                onClick={onLogin}
                sx={{ height: 48, fontSize: '1rem' }}
              >
                {busy ? <CircularProgress size={24} color="inherit" /> : '登录'}
              </Button>
              
              <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', my: 2 }}>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
                  <Typography variant="caption" sx={{ px: 2, color: 'text.secondary' }}>或</Typography>
                  <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Box>

              <Button 
                variant="outlined" 
                color="inherit" 
                fullWidth 
                size="large"
                disabled={!canSubmit}
                onClick={onRegisterAndLogin}
                sx={{ height: 48, borderColor: 'divider', color: 'text.secondary' }}
              >
                创建账号
              </Button>
            </Stack>
          </Paper>
        </motion.div>
        
        <Box textAlign="center" mt={4}>
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6 }}>
             © 2026 MercuryDesk • Sender‑Centric MVP
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
