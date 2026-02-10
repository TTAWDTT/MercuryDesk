import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ApiError, login, register, setToken } from '../api';
import { useAuth } from '../contexts/AuthContext';
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
import { useTheme } from '@mui/material/styles';
import { cardBgLight, cardBgDark } from '../theme';

export default function Login() {
  const theme = useTheme();
  const { setAuthed } = useAuth();
  const [email, setEmail] = useState(import.meta.env.DEV ? 'demo@example.com' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password123' : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return isValidEmail && password.length >= 8 && !busy;
  }, [email, password, busy]);

  async function onLogin() {
    setBusy(true);
    setError(null);
    try {
      const token = await login(email, password);
      setToken(token.access_token);
      setAuthed(true);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) onLogin();
  };

  const shadowColor = theme.palette.text.primary;

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
              borderRadius: 0,
              border: '3px solid',
              borderColor: 'text.primary',
              bgcolor: 'background.paper',
              backgroundImage: theme.palette.mode === 'light' ? cardBgLight : cardBgDark,
              boxShadow: `8px 8px 0 0 ${shadowColor}`,
              // Manga cover: slight rotation for hand-drawn feel
              transform: 'rotate(-0.8deg)',
              '&:hover': { transform: 'rotate(0deg)', transition: 'transform 0.3s ease' },
              transition: 'transform 0.3s ease',
            }}
          >
            <Box textAlign="center" mb={4}>
              <Box
                sx={{
                  width: 96,
                  height: 96,
                  borderRadius: 0,
                  border: '3px solid',
                  borderColor: 'text.primary',
                  background: 'transparent',
                  margin: '0 auto 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'text.primary',
                  fontWeight: '900',
                  fontSize: '52px',
                  fontFamily: '"Inter", sans-serif',
                  letterSpacing: '-0.04em',
                  boxShadow: `4px 4px 0 0 ${shadowColor}`
                }}
              >
                M
              </Box>
              <Typography variant="h3" fontWeight="900" color="textPrimary" sx={{ letterSpacing: '-0.02em' }} gutterBottom>
                MercuryDesk
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic', letterSpacing: '0.05em', mb: 0.5 }}>
                Vol.1 • Issue 2026
              </Typography>
              <Typography variant="body1" color="textSecondary">
                统一收件箱（按发信人聚合）。
              </Typography>
            </Box>

            <Stack spacing={3}>
              <form onSubmit={handleSubmit}>
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
                type="submit"
                disabled={!canSubmit}
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
                type="button"
                disabled={!canSubmit}
                onClick={onRegisterAndLogin}
                sx={{ height: 48, borderColor: 'divider', color: 'text.secondary' }}
              >
                创建账号
              </Button>
              </Stack>
              </form>
            </Stack>
          </Paper>
        </motion.div>
        
        <Box textAlign="center" mt={4}>
          <Typography variant="caption" color="text.secondary" sx={{ opacity: 0.6, fontStyle: 'italic' }}>
             © 2026 MercuryDesk • Sender‑Centric MVP • 初版
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
