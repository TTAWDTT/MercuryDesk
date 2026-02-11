import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { AgentAdvancedSearchItem } from '../../api';

type AgentSearchPanelProps = {
  query: string;
  source: string;
  unreadOnly: boolean;
  days: number;
  limit: number;
  busy: boolean;
  items: AgentAdvancedSearchItem[];
  onQueryChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onUnreadOnlyChange: (value: boolean) => void;
  onDaysChange: (value: number) => void;
  onLimitChange: (value: number) => void;
  onSearch: () => void;
  onOpenContact: (contactId?: number | null) => void;
};

export function AgentSearchPanel({
  query,
  source,
  unreadOnly,
  days,
  limit,
  busy,
  items,
  onQueryChange,
  onSourceChange,
  onUnreadOnlyChange,
  onDaysChange,
  onLimitChange,
  onSearch,
  onOpenContact,
}: AgentSearchPanelProps) {
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        高级检索
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
        关键词 + 时效 + 未读权重排序，适合快速定位需要处理的信息。
      </Typography>
      <Stack spacing={1.1} sx={{ mt: 1.2 }}>
        <TextField
          size="small"
          label="查询词"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="如：合作报价 / campaign / 风险"
        />
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            select
            label="来源"
            value={source}
            onChange={(event) => onSourceChange(event.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="imap">邮件</MenuItem>
            <MenuItem value="github">GitHub</MenuItem>
            <MenuItem value="rss">RSS</MenuItem>
            <MenuItem value="x">X</MenuItem>
            <MenuItem value="bilibili">Bilibili</MenuItem>
            <MenuItem value="douyin">抖音</MenuItem>
            <MenuItem value="xiaohongshu">小红书</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="number"
            label="近几天"
            inputProps={{ min: 1, max: 365 }}
            value={days}
            onChange={(event) => onDaysChange(Math.max(1, Math.min(365, Number(event.target.value) || 30)))}
          />
          <TextField
            size="small"
            type="number"
            label="条数"
            inputProps={{ min: 1, max: 100 }}
            value={limit}
            onChange={(event) => onLimitChange(Math.max(1, Math.min(100, Number(event.target.value) || 20)))}
          />
        </Stack>
        <FormControlLabel
          control={<Checkbox checked={unreadOnly} onChange={(event) => onUnreadOnlyChange(event.target.checked)} />}
          label="仅看未读"
        />
        <Button variant="contained" onClick={onSearch} disabled={busy}>
          {busy ? '检索中…' : '开始检索'}
        </Button>
      </Stack>

      <Box sx={{ mt: 1.4, display: 'grid', gap: 0.8 }}>
        {!busy && items.length > 0 && (
          <Chip size="small" label={`检索结果 ${items.length} 条`} sx={{ justifySelf: 'start' }} />
        )}
        {items.map((item) => (
          <Paper
            key={`${item.message_id}-${item.score}`}
            variant="outlined"
            sx={{ p: 1.2, borderStyle: 'dashed' }}
          >
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="small" label={item.source} />
              <Chip size="small" variant="outlined" label={`score ${item.score}`} />
              {!item.is_read && <Chip size="small" color="warning" label="未读" />}
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 700 }}>
              {item.subject || '(无主题)'}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
              {item.sender} · {item.received_at} · {item.reason}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
              {item.preview}
            </Typography>
            <Button size="small" sx={{ mt: 0.8 }} onClick={() => onOpenContact(item.contact_id)}>
              打开联系人
            </Button>
          </Paper>
        ))}
        {!busy && items.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            还没有检索结果。
          </Typography>
        )}
      </Box>
    </Box>
  );
}
