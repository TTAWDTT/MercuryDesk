import React from "react";
import { motion } from "framer-motion";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import InputAdornment from "@mui/material/InputAdornment";
import LockIcon from "@mui/icons-material/LockOutlined";
import EmailIcon from "@mui/icons-material/EmailOutlined";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

type LoginPanelProps = {
  email: string;
  password: string;
  busy: boolean;
  canSubmit: boolean;
  error: string | null;
  shadowColor: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onRegisterAndLogin: () => void;
};

export function LoginPanel({
  email,
  password,
  busy,
  canSubmit,
  error,
  shadowColor,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onRegisterAndLogin,
}: LoginPanelProps) {
  return (
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
          width: "100%",
          borderRadius: 0,
          border: "3px solid",
          borderColor: "text.primary",
          bgcolor: "background.paper",
          backgroundImage: "none",
          boxShadow: `6px 6px 0 0 ${shadowColor}`,
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 6,
            left: 6,
            right: 6,
            bottom: 6,
            border: "1px solid",
            borderColor: "divider",
            opacity: 0.15,
            pointerEvents: "none",
          },
        }}
      >
        <Box textAlign="center" mb={4}>
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 0,
              border: "3px solid",
              borderColor: "text.primary",
              background: "transparent",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.primary",
              fontWeight: "900",
              fontSize: "36px",
              letterSpacing: "-0.06em",
              boxShadow: `4px 4px 0 0 ${shadowColor}`,
            }}
          >
            M
          </Box>
          <Typography variant="h4" fontWeight="900" color="textPrimary" sx={{ letterSpacing: "-0.03em" }} gutterBottom>
            MercuryDesk
          </Typography>
          <Typography variant="caption" color="textSecondary" sx={{ letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700 }}>
            Unified Inbox · Sender-Centric
          </Typography>
        </Box>

        <Stack spacing={3}>
          <form onSubmit={onSubmit}>
            <Stack spacing={3}>
              <TextField
                label="邮箱"
                variant="outlined"
                fullWidth
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
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
                onChange={(event) => onPasswordChange(event.target.value)}
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
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <Alert severity="error" sx={{ borderRadius: 2 }}>
                    {error}
                  </Alert>
                </motion.div>
              )}

              <Button variant="contained" color="primary" fullWidth size="large" type="submit" disabled={!canSubmit} sx={{ height: 48, fontSize: "1rem" }}>
                {busy ? <CircularProgress size={24} color="inherit" /> : "登录"}
              </Button>

              <Box sx={{ position: "relative", display: "flex", alignItems: "center", my: 2 }}>
                <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
                <Typography variant="caption" sx={{ px: 2, color: "text.secondary" }}>
                  或
                </Typography>
                <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
              </Box>

              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                size="large"
                type="button"
                disabled={!canSubmit}
                onClick={onRegisterAndLogin}
                sx={{ height: 48, borderColor: "divider", color: "text.secondary" }}
              >
                创建账号
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </motion.div>
  );
}

