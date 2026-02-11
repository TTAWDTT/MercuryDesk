import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
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
