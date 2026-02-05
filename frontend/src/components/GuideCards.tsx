import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import { alpha, useTheme } from '@mui/material/styles';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SyncOutlinedIcon from '@mui/icons-material/SyncOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import { motion } from 'framer-motion';

interface GuideCardsProps {
  hasAccounts: boolean;
  syncing: boolean;
  onOpenSettings: () => void;
  onSync: () => void;
}

export function GuideCards({ hasAccounts, syncing, onOpenSettings, onSync }: GuideCardsProps) {
  const theme = useTheme();

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(12, minmax(0, 1fr))',
        },
        gap: { xs: 2, md: 3 },
        alignItems: 'stretch',
      }}
    >
      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 8' } }}>
        <Card
          elevation={0}
          sx={{
            height: '100%',
            borderRadius: '18px',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            position: 'relative',
            transition: 'all 0.25s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              borderColor: 'primary.main',
              boxShadow: theme.shadows[4],
            },
          }}
        >
          <Box sx={{ position: 'absolute', top: 14, left: 14, zIndex: 1 }}>
            <Chip
              label="Guide"
              size="small"
              variant="outlined"
              sx={{
                borderRadius: 999,
                fontWeight: 700,
                letterSpacing: '0.02em',
                bgcolor: alpha(theme.palette.background.paper, 0.85),
                backdropFilter: 'blur(10px)',
              }}
            />
          </Box>

          <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: 'primary.main',
                }}
              >
                <EmailOutlinedIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                  Connect your inbox
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Add IMAP (Gmail / Outlook app password) and start syncing real messages by sender.
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                p: 2.25,
                borderRadius: '14px',
                bgcolor: alpha(theme.palette.action.hover, 0.55),
              }}
            >
              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                {hasAccounts ? 'Tip' : 'First step'}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
                Open Settings → Connected Accounts → select <b>IMAP</b>, then enter host/username/password. When
                you&apos;re ready, hit <b>Sync</b>.
              </Typography>
            </Box>
          </CardContent>

          <CardActions sx={{ px: { xs: 3, md: 3.5 }, pb: { xs: 3, md: 3.5 } }}>
            <Button startIcon={<SettingsIcon />} variant="contained" onClick={onOpenSettings}>
              Open Settings
            </Button>
            {!hasAccounts && (
              <Button startIcon={<SyncOutlinedIcon />} variant="outlined" onClick={onSync} disabled={syncing}>
                Sync demo
              </Button>
            )}
          </CardActions>
        </Card>
      </Box>

      <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 4' } }}>
        <Card
          elevation={0}
          sx={{
            height: '100%',
            borderRadius: '18px',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden',
            transition: 'all 0.25s ease',
            '&:hover': {
              transform: 'translateY(-3px)',
              borderColor: 'primary.main',
              boxShadow: theme.shadows[4],
            },
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
              <SearchIcon color="action" />
              <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                Sync & search
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
              Use the top bar to <b>Sync Accounts</b>, then search senders instantly. Cards are arranged in a
              magazine-style grid for fast scanning.
            </Typography>
          </CardContent>
          <CardActions sx={{ px: { xs: 3, md: 3.5 }, pb: { xs: 3, md: 3.5 } }}>
            <Button startIcon={<SyncOutlinedIcon />} variant="outlined" onClick={onSync} disabled={syncing}>
              Sync now
            </Button>
          </CardActions>
        </Card>
      </Box>
    </Box>
  );
}

