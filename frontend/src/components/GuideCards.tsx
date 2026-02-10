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
            borderRadius: 0,
            border: '2px solid',
            borderColor: 'text.primary',
            overflow: 'hidden',
            position: 'relative',
            transition: 'all 0.25s ease',
            boxShadow: `4px 4px 0 0 ${theme.palette.text.primary}`,
            '&:hover': {
              transform: 'translate(-2px, -2px)',
              boxShadow: `6px 6px 0 0 ${theme.palette.text.primary}`,
            },
          }}
        >
          <Box sx={{ position: 'absolute', top: 14, left: 14, zIndex: 1 }}>
            <Chip
              label="新手引导"
              size="small"
              variant="outlined"
              sx={{
                borderRadius: 0,
                fontWeight: 700,
                letterSpacing: '0.02em',
                bgcolor: 'background.paper',
                border: '2px solid',
                borderColor: 'text.primary',
                boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.3)}`
              }}
            />
          </Box>

          <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 0,
                  border: '2px solid',
                  borderColor: 'text.primary',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'transparent',
                  color: 'text.primary',
                  boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.3)}`
                }}
              >
                <EmailOutlinedIcon />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                  连接你的邮箱
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  通过 IMAP（Gmail / Outlook 授权码）同步真实邮件，并按发信人自动聚合。
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                p: 2.25,
                borderRadius: 0,
                border: '2px solid',
                borderColor: 'divider',
                bgcolor: 'transparent',
                backgroundImage: 'repeating-linear-gradient(-45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 4px)',
              }}
            >
              <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                {hasAccounts ? '小贴士' : '第一步'}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
                打开 设置 → 已连接账户 → 选择 <b>IMAP</b>，填入主机/用户名/授权码（或密码）。完成后点击顶部 <b>同步</b>。
              </Typography>
            </Box>
          </CardContent>

          <CardActions sx={{ px: { xs: 3, md: 3.5 }, pb: { xs: 3, md: 3.5 } }}>
            <Button startIcon={<SettingsIcon />} variant="contained" onClick={onOpenSettings}>
              打开设置
            </Button>
            {!hasAccounts && (
              <Button startIcon={<SyncOutlinedIcon />} variant="outlined" onClick={onSync} disabled={syncing}>
                同步演示数据
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
            borderRadius: 0,
            border: '2px solid',
            borderColor: 'text.primary',
            overflow: 'hidden',
            transition: 'all 0.25s ease',
            boxShadow: `4px 4px 0 0 ${theme.palette.text.primary}`,
            '&:hover': {
              transform: 'translate(-2px, -2px)',
              boxShadow: `6px 6px 0 0 ${theme.palette.text.primary}`,
            },
          }}
        >
          <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
            <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
              <SearchIcon color="action" />
              <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: '-0.02em' }}>
                同步与搜索
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary" sx={{ lineHeight: 1.6 }}>
              用顶部栏一键 <b>同步</b>，然后直接搜索发信人。卡片采用“杂志式”网格排布，方便快速浏览。
            </Typography>
          </CardContent>
          <CardActions sx={{ px: { xs: 3, md: 3.5 }, pb: { xs: 3, md: 3.5 } }}>
            <Button startIcon={<SyncOutlinedIcon />} variant="outlined" onClick={onSync} disabled={syncing}>
              立即同步
            </Button>
          </CardActions>
        </Card>
      </Box>
    </Box>
  );
}
