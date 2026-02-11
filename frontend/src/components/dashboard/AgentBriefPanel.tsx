import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AgentDailyBrief, AgentDailyBriefAction } from '../../api';

type AgentBriefPanelProps = {
  dailyBrief?: AgentDailyBrief;
  actionBusy: boolean;
  onApplyAction: (action: AgentDailyBriefAction) => void;
};

export function AgentBriefPanel({ dailyBrief, actionBusy, onApplyAction }: AgentBriefPanelProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        每日简报
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
        {dailyBrief?.summary || '正在生成每日简报…'}
      </Typography>

      {!dailyBrief && <LinearProgress sx={{ mt: 1.4 }} />}

      {!!dailyBrief?.top_updates?.length && (
        <Box sx={{ mt: 1.6, display: 'grid', gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            高价值更新（按优先级排序）
          </Typography>
          {dailyBrief.top_updates.slice(0, 4).map((item) => (
            <Paper
              key={`${item.message_id}-${item.source}`}
              variant="outlined"
              sx={{ p: 1.2, borderStyle: 'dashed' }}
            >
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip size="small" label={item.source_label} />
                <Chip size="small" variant="outlined" label={`分数 ${Math.round(item.score)}`} />
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 700 }}>
                {item.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.sender} · {item.received_at}
              </Typography>
            </Paper>
          ))}
        </Box>
      )}

      {!!dailyBrief?.actions?.length && (
        <Box sx={{ mt: 1.6, display: 'grid', gap: 0.9 }}>
          <Typography variant="caption" color="text.secondary">
            推荐行动（可一键执行）
          </Typography>
          {dailyBrief.actions.slice(0, 6).map((action, idx) => (
            <Box
              key={`${action.kind}-${action.title}-${idx}`}
              sx={{
                border: '1px dashed',
                borderColor: 'divider',
                p: 1,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 1,
              }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {action.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {action.detail || '无补充信息'}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                disabled={actionBusy}
                onClick={() => onApplyAction(action)}
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
