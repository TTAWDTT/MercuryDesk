import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import { AgentDailyBrief, AgentDailyBriefAction } from '../../api';

type AgentBriefPanelProps = {
  dailyBrief?: AgentDailyBrief;
  actionBusy: boolean;
  onApplyAction: (action: AgentDailyBriefAction) => void;
};

export function AgentBriefPanel({ dailyBrief, actionBusy, onApplyAction }: AgentBriefPanelProps) {
  const theme = useTheme();

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        每日简报
      </Typography>
      <Paper
        variant="outlined"
        sx={{
          mt: 0.85,
          p: 1.05,
          bgcolor: alpha(theme.palette.background.default, theme.palette.mode === 'light' ? 0.42 : 0.25),
        }}
      >
        <Typography variant="body2" color={dailyBrief?.summary ? 'text.primary' : 'text.secondary'} sx={{ lineHeight: 1.55 }}>
          {dailyBrief?.summary || '正在生成每日简报…'}
        </Typography>
      </Paper>

      {!dailyBrief && <LinearProgress sx={{ mt: 1.4 }} />}

      {!!dailyBrief?.actions?.length && (
        <Box sx={{ mt: 1.2, display: 'grid', gap: 0.7 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.15 }}>
            推荐行动（可一键执行）
          </Typography>
          {dailyBrief.actions.slice(0, 6).map((action, idx) => (
            <Box
              key={`${action.kind}-${action.title}-${idx}`}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                p: 0.9,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 0.9,
                transition: 'border-color 180ms ease, background-color 180ms ease',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.4),
                  bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.04 : 0.08),
                },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
                  {action.title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    mt: 0.15,
                    display: '-webkit-box',
                    lineHeight: 1.42,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {action.detail || '无补充信息'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                disabled={actionBusy}
                onClick={() => onApplyAction(action)}
                sx={{ minHeight: 28, px: 1.1, whiteSpace: 'nowrap' }}
              >
                执行
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
