import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { AgentMemorySnapshot } from '../../api';

type AgentMemoryPanelProps = {
  memorySnapshot: AgentMemorySnapshot | null;
  memoryBusy: boolean;
  memoryCorrection: string;
  onMemoryCorrectionChange: (value: string) => void;
  onRefresh: () => void;
  onSaveCorrection: () => void;
  onDeleteNote: (noteId: number) => void;
};

const KIND_LABEL: Record<string, string> = {
  preference: '偏好',
  fact: '事实',
  todo: '待办',
  layout: '布局',
  note: '备注',
};

const LAYOUT_MARKER = '- 布局数据: ';

function tryParseJson(raw: string): unknown | null {
  const text = (raw || '').trim();
  if (!text) return null;
  if ((!text.startsWith('{') || !text.endsWith('}')) && (!text.startsWith('[') || !text.endsWith(']'))) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractLayoutCards(content: string): Array<Record<string, unknown>> {
  const idx = content.indexOf(LAYOUT_MARKER);
  if (idx < 0) return [];
  const raw = content.slice(idx + LAYOUT_MARKER.length).trim();
  const parsed = tryParseJson(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'));
}

function extractWorkspace(content: string): string | null {
  const match = content.match(/-\s*工作区:\s*([^\n]+)/);
  return match ? match[1].trim() : null;
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const encoded = JSON.stringify(value);
    return encoded.length > 90 ? `${encoded.slice(0, 90)}…` : encoded;
  } catch {
    return String(value);
  }
}

export function AgentMemoryPanel({
  memorySnapshot,
  memoryBusy,
  memoryCorrection,
  onMemoryCorrectionChange,
  onRefresh,
  onSaveCorrection,
  onDeleteNote,
}: AgentMemoryPanelProps) {
  const [showAllNotes, setShowAllNotes] = React.useState(false);

  const focusBySource = React.useMemo(() => {
    const groups = new Map<string, number>();
    for (const item of memorySnapshot?.focus_items ?? []) {
      groups.set(item.source_label, (groups.get(item.source_label) || 0) + 1);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1] - a[1]);
  }, [memorySnapshot?.focus_items]);

  const notesByKind = React.useMemo(() => {
    const groups = new Map<string, NonNullable<AgentMemoryPanelProps['memorySnapshot']>['notes']>();
    for (const note of memorySnapshot?.notes ?? []) {
      const key = (note.kind || 'note').toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(note);
    }
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [memorySnapshot?.notes]);

  const visibleFocus = (memorySnapshot?.focus_items ?? []).slice(0, 8);
  const allNotes = memorySnapshot?.notes ?? [];
  const visibleNotes = showAllNotes ? allNotes : allNotes.slice(0, 8);

  const renderStructuredNote = (note: (typeof allNotes)[number]) => {
    const layoutCards = extractLayoutCards(note.content);
    if (layoutCards.length > 0) {
      const workspace = extractWorkspace(note.content) || (note.source?.replace('card_layout:', '') || 'default');
      const pinned = layoutCards.filter((item) => Boolean(item.pinned)).length;
      return (
        <Box sx={{ mt: 0.45 }}>
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`工作区 ${workspace}`} />
            <Chip size="small" variant="outlined" label={`卡片 ${layoutCards.length}`} />
            <Chip size="small" variant="outlined" label={`置顶 ${pinned}`} />
          </Stack>
          <Box sx={{ mt: 0.8, display: 'grid', gap: 0.6 }}>
            {layoutCards.slice(0, 6).map((item, index) => (
              <Paper key={`${item.contact_id ?? index}`} variant="outlined" sx={{ p: 0.65, borderStyle: 'dashed' }}>
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {compactValue(item.display_name || item.contact_id || `card-${index + 1}`)}
                  </Typography>
                  {Boolean(item.pinned) && <Chip size="small" color="primary" label="置顶" />}
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`${compactValue(item.x)}, ${compactValue(item.y)} · ${compactValue(item.width)}x${compactValue(item.height)}`}
                  />
                </Stack>
              </Paper>
            ))}
            {layoutCards.length > 6 && (
              <Typography variant="caption" color="text.secondary">
                还有 {layoutCards.length - 6} 张卡片未展开显示。
              </Typography>
            )}
          </Box>
        </Box>
      );
    }

    const jsonPayload = tryParseJson(note.content);
    if (jsonPayload && typeof jsonPayload === 'object' && !Array.isArray(jsonPayload)) {
      const object = jsonPayload as Record<string, unknown>;
      const isTodoLike = 'title' in object && ('done' in object || 'priority' in object);
      if (isTodoLike) {
        return (
          <Box sx={{ mt: 0.45 }}>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
              {'priority' in object ? (
                <Chip size="small" variant="outlined" label={`优先级 ${compactValue(object.priority)}`} />
              ) : null}
              {'done' in object ? (
                <Chip
                  size="small"
                  color={Boolean(object.done) ? 'success' : 'default'}
                  label={Boolean(object.done) ? '已完成' : '未完成'}
                />
              ) : null}
              {'due_at' in object && object.due_at ? (
                <Chip size="small" variant="outlined" label={`截止 ${compactValue(object.due_at)}`} />
              ) : null}
            </Stack>
            <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 700 }}>
              {compactValue(object.title)}
            </Typography>
            {'detail' in object && object.detail ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
                {compactValue(object.detail)}
              </Typography>
            ) : null}
          </Box>
        );
      }

      const entries = Object.entries(object).slice(0, 8);
      return (
        <Box sx={{ mt: 0.45, display: 'grid', gap: 0.5 }}>
          {entries.map(([key, value]) => (
            <Stack key={key} direction="row" spacing={0.8} alignItems="center">
              <Chip size="small" variant="outlined" label={key} />
              <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                {compactValue(value)}
              </Typography>
            </Stack>
          ))}
        </Box>
      );
    }

    if (Array.isArray(jsonPayload)) {
      return (
        <Box sx={{ mt: 0.45 }}>
          <Chip size="small" variant="outlined" label={`JSON 数组 ${jsonPayload.length} 项`} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.45, display: 'block' }}>
            {compactValue(jsonPayload.slice(0, 2))}
          </Typography>
        </Box>
      );
    }

    return (
      <Typography variant="body2" sx={{ mt: 0.45, whiteSpace: 'pre-wrap' }}>
        {note.content}
      </Typography>
    );
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          记忆解释面板
        </Typography>
        <Button size="small" variant="outlined" onClick={onRefresh}>
          刷新
        </Button>
      </Stack>

      {memoryBusy && <LinearProgress sx={{ mt: 1.2 }} />}
      {!memorySnapshot && !memoryBusy && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2 }}>
          记忆尚未生成。
        </Typography>
      )}

      {!!memorySnapshot && (
        <>
          <Paper variant="outlined" sx={{ mt: 1.1, p: 1.2, borderStyle: 'dashed' }}>
            <Typography variant="caption" color="text.secondary">
              当前记忆摘要
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.4, fontWeight: 600 }}>
              {(memorySnapshot.summary || '暂无摘要').trim() || '暂无摘要'}
            </Typography>
            <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.9 }}>
              <Chip size="small" label={`关注线索 ${memorySnapshot.focus_items.length}`} />
              <Chip size="small" label={`记忆条目 ${memorySnapshot.notes.length}`} />
              {focusBySource.slice(0, 3).map(([source, count]) => (
                <Chip key={source} size="small" variant="outlined" label={`${source} ${count}`} />
              ))}
            </Stack>
          </Paper>

          <Divider sx={{ my: 1.2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            最近关注线索
          </Typography>
          <Typography variant="caption" color="text.secondary">
            AI 会优先参考这里的消息来源、主题和时间。
          </Typography>
          <Box sx={{ mt: 0.9, display: 'grid', gap: 0.8 }}>
            {visibleFocus.map((item) => (
              <Paper key={`${item.message_id}-${item.source}`} variant="outlined" sx={{ p: 0.9 }}>
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={item.source_label} />
                  <Chip size="small" variant="outlined" label={`score ${Math.round(item.score)}`} />
                  <Typography variant="caption" color="text.secondary">
                    {item.sender} · {item.received_at}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 700 }}>
                  {item.title}
                </Typography>
              </Paper>
            ))}
            {visibleFocus.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                暂无关注线索。
              </Typography>
            )}
          </Box>

          <Divider sx={{ my: 1.2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            记忆条目（可编辑）
          </Typography>
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.7 }}>
            {notesByKind.map(([kind, items]) => (
              <Chip
                key={kind}
                size="small"
                variant="outlined"
                label={`${KIND_LABEL[kind] || kind} ${items.length}`}
              />
            ))}
          </Stack>

          <Box sx={{ mt: 0.9, display: 'grid', gap: 0.7 }}>
            {visibleNotes.map((note) => (
              <Paper
                key={note.id}
                variant="outlined"
                sx={{
                  p: 0.8,
                  borderStyle: 'dashed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip size="small" label={KIND_LABEL[note.kind] || note.kind} />
                    {note.source ? <Chip size="small" variant="outlined" label={note.source} /> : null}
                  </Stack>
                  {renderStructuredNote(note)}
                </Box>
                <IconButton size="small" onClick={() => onDeleteNote(note.id)}>
                  <DeleteOutlineIcon fontSize="inherit" />
                </IconButton>
              </Paper>
            ))}
            {allNotes.length > 8 && (
              <Button size="small" variant="text" onClick={() => setShowAllNotes((prev) => !prev)}>
                {showAllNotes ? '收起部分条目' : `展开全部 ${allNotes.length} 条`}
              </Button>
            )}
          </Box>
        </>
      )}

      <Divider sx={{ my: 1.2 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        手动校正记忆
      </Typography>
      <Typography variant="caption" color="text.secondary">
        写入后会直接进入 AI 上下文（例如偏好、近期重点、不再关注的话题）。
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mt: 0.9 }}>
        <TextField
          size="small"
          fullWidth
          value={memoryCorrection}
          onChange={(event) => onMemoryCorrectionChange(event.target.value)}
          placeholder="例如：我近期优先关注抖音商业合作私信，不关注娱乐话题。"
        />
        <Button variant="contained" onClick={onSaveCorrection} disabled={memoryBusy}>
          保存
        </Button>
      </Stack>
    </Box>
  );
}
