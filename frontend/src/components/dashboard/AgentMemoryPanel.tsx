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
import ReactMarkdown from 'react-markdown';
import { alpha, useTheme } from '@mui/material/styles';
import { AgentFocusItem, AgentMemoryNote, AgentMemorySnapshot } from '../../api';

type AgentMemoryPanelProps = {
  memorySnapshot: AgentMemorySnapshot | null;
  memoryBusy: boolean;
  memoryCorrection: string;
  onMemoryCorrectionChange: (value: string) => void;
  onRefresh: () => void;
  onSaveCorrection: () => void;
  onDeleteNote: (noteId: number) => void;
};

type LayoutCard = {
  contact_id: number;
  display_name: string;
  pinned: boolean;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ParsedMemoryNote = {
  note: AgentMemoryNote;
  category: 'layout' | 'todo' | 'json_object' | 'json_array' | 'markdown' | 'text';
  workspace?: string | null;
  layoutCards?: LayoutCard[];
  todoObject?: Record<string, unknown>;
  jsonObject?: Record<string, unknown>;
  jsonArray?: unknown[];
};

const KIND_LABEL: Record<string, string> = {
  preference: '偏好',
  fact: '事实',
  todo: '待办',
  layout: '布局',
  note: '备注',
};

const SOURCE_LABEL: Record<string, string> = {
  chat: '对话',
  manual: '手动',
  todo: '待办',
  card_layout: '画板布局',
};

const LAYOUT_MARKER = '- 布局数据: ';
const MARKDOWN_PATTERN =
  /(^|\n)\s*#{1,6}\s+|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))|(^|\n)\s*>\s+|```|`[^`]+`|(^|\n)\s*[-*]\s+|(^|\n)\s*\d+\.\s+/m;

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

function compactValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value.length > 100 ? `${value.slice(0, 100)}…` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const encoded = JSON.stringify(value);
    return encoded.length > 100 ? `${encoded.slice(0, 100)}…` : encoded;
  } catch {
    return String(value);
  }
}

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

function extractWorkspace(content: string): string | null {
  const match = content.match(/-\s*工作区:\s*([^\n]+)/);
  return match ? match[1].trim() : null;
}

function extractLayoutCards(content: string): LayoutCard[] {
  const idx = content.indexOf(LAYOUT_MARKER);
  if (idx < 0) return [];
  const raw = content.slice(idx + LAYOUT_MARKER.length).trim();
  const parsed = tryParseJson(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => ({
      contact_id: Math.max(0, Math.floor(safeNumber(item.contact_id, 0))),
      display_name: String(item.display_name || item.contact_id || 'card'),
      pinned: Boolean(item.pinned),
      order: Math.max(0, Math.floor(safeNumber(item.order, 0))),
      x: Math.max(0, safeNumber(item.x, 0)),
      y: Math.max(0, safeNumber(item.y, 0)),
      width: Math.max(120, safeNumber(item.width, 312)),
      height: Math.max(120, safeNumber(item.height, 316)),
    }))
    .slice(0, 200);
}

function getWorkspaceFromSource(source?: string | null): string | null {
  if (!source) return null;
  if (source === 'card_layout') return 'default';
  if (source.startsWith('card_layout:')) return source.replace('card_layout:', '') || 'default';
  return null;
}

function normalizeSourceLabel(source?: string | null): string {
  if (!source) return '未知';
  const direct = SOURCE_LABEL[source];
  if (direct) return direct;
  if (source.startsWith('card_layout:')) {
    const workspace = source.replace('card_layout:', '') || 'default';
    return `画板布局(${workspace})`;
  }
  return source;
}

function looksLikeTodoObject(value: Record<string, unknown>): boolean {
  return 'title' in value && ('done' in value || 'priority' in value || 'due_at' in value);
}

function parseMemoryNote(note: AgentMemoryNote): ParsedMemoryNote {
  const workspaceFromContent = extractWorkspace(note.content);
  const workspaceFromSource = getWorkspaceFromSource(note.source);
  const layoutCards = extractLayoutCards(note.content);
  if (layoutCards.length > 0) {
    return {
      note,
      category: 'layout',
      workspace: workspaceFromContent || workspaceFromSource || 'default',
      layoutCards,
    };
  }

  const payload = tryParseJson(note.content);
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const object = payload as Record<string, unknown>;
    if (looksLikeTodoObject(object) || note.source === 'todo' || note.kind === 'todo') {
      return {
        note,
        category: 'todo',
        todoObject: object,
      };
    }
    return {
      note,
      category: 'json_object',
      jsonObject: object,
    };
  }

  if (Array.isArray(payload)) {
    return {
      note,
      category: 'json_array',
      jsonArray: payload,
    };
  }

  return { note, category: looksLikeMarkdown(note.content) ? 'markdown' : 'text' };
}

function looksLikeMarkdown(text: string): boolean {
  const clean = (text || '').trim();
  if (!clean) return false;
  return MARKDOWN_PATTERN.test(clean);
}

function sourceColor(sourceLabel: string): 'primary' | 'secondary' | 'success' | 'warning' | 'default' {
  const lower = sourceLabel.toLowerCase();
  if (lower.includes('x') || lower.includes('抖音') || lower.includes('小红书')) return 'primary';
  if (lower.includes('github') || lower.includes('rss')) return 'secondary';
  if (lower.includes('email') || lower.includes('消息')) return 'success';
  return 'default';
}

function formatTime(text: string): string {
  if (!text) return '-';
  const clean = text.replace('T', ' ');
  return clean.length > 16 ? clean.slice(0, 16) : clean;
}

function LayoutMiniMap({ cards }: { cards: LayoutCard[] }) {
  const theme = useTheme();
  const sample = React.useMemo(() => cards.slice(0, 48), [cards]);
  const bounds = React.useMemo(() => {
    if (sample.length === 0) return null;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;
    sample.forEach((card) => {
      minX = Math.min(minX, card.x);
      minY = Math.min(minY, card.y);
      maxRight = Math.max(maxRight, card.x + card.width);
      maxBottom = Math.max(maxBottom, card.y + card.height);
    });
    return {
      minX,
      minY,
      spanX: Math.max(1, maxRight - minX),
      spanY: Math.max(1, maxBottom - minY),
    };
  }, [sample]);

  if (!bounds || sample.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        暂无可视化布局数据。
      </Typography>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          mt: 0.8,
          position: 'relative',
          height: 164,
          borderRadius: 1.8,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: alpha(theme.palette.background.default, 0.55),
          overflow: 'hidden',
        }}
      >
        {sample.map((card, idx) => {
          const left = ((card.x - bounds.minX) / bounds.spanX) * 100;
          const top = ((card.y - bounds.minY) / bounds.spanY) * 100;
          const width = (card.width / bounds.spanX) * 100;
          const height = (card.height / bounds.spanY) * 100;
          const clampedLeft = Math.max(0, Math.min(96, left));
          const clampedTop = Math.max(0, Math.min(96, top));
          const clampedWidth = Math.max(3, Math.min(100 - clampedLeft, width));
          const clampedHeight = Math.max(3, Math.min(100 - clampedTop, height));
          return (
            <Box
              key={`${card.contact_id}-${idx}`}
              title={`${card.display_name} (${Math.round(card.x)},${Math.round(card.y)}) ${Math.round(card.width)}x${Math.round(card.height)}`}
              sx={{
                position: 'absolute',
                left: `${clampedLeft}%`,
                top: `${clampedTop}%`,
                width: `${clampedWidth}%`,
                height: `${clampedHeight}%`,
                bgcolor: card.pinned ? alpha(theme.palette.primary.main, 0.76) : alpha(theme.palette.text.primary, 0.16),
                border: '1px solid',
                borderColor: card.pinned ? alpha(theme.palette.primary.main, 0.88) : alpha(theme.palette.text.primary, 0.35),
                borderRadius: 0.8,
              }}
            />
          );
        })}
      </Box>
      {cards.length > sample.length && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          仅绘制前 {sample.length} 张卡片，完整数据见下方结构化列表。
        </Typography>
      )}
    </Box>
  );
}

function renderObjectRows(object: Record<string, unknown>) {
  const entries = Object.entries(object).slice(0, 12);
  return (
    <Box sx={{ mt: 0.6, display: 'grid', gap: 0.5 }}>
      {entries.map(([key, value]) => (
        <Stack key={key} direction="row" spacing={0.8} alignItems="flex-start">
          <Typography
            variant="caption"
            sx={{ minWidth: 78, color: 'text.primary', fontWeight: 700, wordBreak: 'break-word' }}
          >
            {key}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-word', flex: 1 }}>
            {compactValue(value)}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

function MarkdownPreview({ content, compact = false }: { content: string; compact?: boolean }) {
  return (
    <Box
      sx={{
        mt: compact ? 0.4 : 0.6,
        fontSize: compact ? '0.79rem' : '0.84rem',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        '& p': { my: 0.6, '&:first-of-type': { mt: 0 } },
        '& h1, & h2, & h3, & h4': { my: 0.8, fontSize: '0.92rem', lineHeight: 1.3 },
        '& ul, & ol': { my: 0.65, pl: 2.1 },
        '& li': { my: 0.2 },
        '& blockquote': {
          m: 0,
          my: 0.65,
          px: 1.1,
          py: 0.55,
          borderLeft: '2px solid',
          borderColor: 'divider',
          color: 'text.secondary',
        },
        '& code': {
          fontFamily: 'monospace',
          fontSize: '0.78em',
          bgcolor: 'action.hover',
          px: 0.35,
          borderRadius: 0.6,
        },
        '& pre': {
          m: 0,
          mt: 0.7,
          p: 0.9,
          borderRadius: 1,
          bgcolor: 'action.hover',
          overflowX: 'auto',
        },
      }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </Box>
  );
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
  const theme = useTheme();
  const [showAllFocus, setShowAllFocus] = React.useState(false);
  const [showAllNotes, setShowAllNotes] = React.useState(false);
  const [activeLayoutSource, setActiveLayoutSource] = React.useState<string>('');

  const allNotes = memorySnapshot?.notes ?? [];
  const parsedNotes = React.useMemo(() => allNotes.map((note) => parseMemoryNote(note)), [allNotes]);

  const layoutNotes = React.useMemo(
    () => parsedNotes.filter((note) => note.category === 'layout'),
    [parsedNotes]
  );
  const structuredNotes = React.useMemo(
    () => parsedNotes.filter((note) => note.category !== 'layout'),
    [parsedNotes]
  );

  React.useEffect(() => {
    if (layoutNotes.length === 0) {
      setActiveLayoutSource('');
      return;
    }
    setActiveLayoutSource((prev) => {
      if (prev && layoutNotes.some((x) => x.note.source === prev)) return prev;
      return layoutNotes[0].note.source || '';
    });
  }, [layoutNotes]);

  const currentLayoutNote = React.useMemo(() => {
    if (layoutNotes.length === 0) return null;
    const found = layoutNotes.find((item) => item.note.source === activeLayoutSource);
    return found || layoutNotes[0];
  }, [activeLayoutSource, layoutNotes]);

  const focusItems = memorySnapshot?.focus_items ?? [];
  const visibleFocus = showAllFocus ? focusItems : focusItems.slice(0, 8);
  const visibleNotes = showAllNotes ? structuredNotes : structuredNotes.slice(0, 8);
  const summaryText = (memorySnapshot?.summary || '').trim();

  const layoutCards = currentLayoutNote?.layoutCards ?? [];
  const pinnedCards = React.useMemo(
    () => layoutCards.filter((item) => item.pinned),
    [layoutCards]
  );
  const frontCards = React.useMemo(
    () =>
      [...layoutCards]
        .sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.order - b.order))
        .slice(0, 8),
    [layoutCards]
  );

  return (
    <Box>
      <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          记忆
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
          <Paper variant="outlined" sx={{ mt: 1.1, p: 1.2 }}>
            {summaryText ? (
              looksLikeMarkdown(summaryText) ? (
                <MarkdownPreview content={summaryText} compact />
              ) : (
                <Typography variant="body2" sx={{ mt: 0.15, fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                  {summaryText}
                </Typography>
              )
            ) : (
              <Typography variant="body2" color="text.secondary">
                暂无摘要
              </Typography>
            )}
          </Paper>

          {layoutNotes.length > 0 && (
            <>
              <Divider sx={{ my: 1.2 }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                布局
              </Typography>

              <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.85 }}>
                {layoutNotes.map((item) => {
                  const source = item.note.source || '';
                  const workspace = item.workspace || getWorkspaceFromSource(source) || 'default';
                  const selected = source === activeLayoutSource || (!activeLayoutSource && item === layoutNotes[0]);
                  return (
                    <Chip
                      key={item.note.id}
                      size="small"
                      clickable
                      color={selected ? 'primary' : 'default'}
                      variant={selected ? 'filled' : 'outlined'}
                      label={`${workspace} · ${item.layoutCards?.length ?? 0}`}
                      onClick={() => setActiveLayoutSource(source)}
                    />
                  );
                })}
              </Stack>

              <Paper variant="outlined" sx={{ mt: 0.9, p: 1.05 }}>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={`工作区 ${currentLayoutNote?.workspace || 'default'}`} />
                  <Chip size="small" variant="outlined" label={`置顶 ${pinnedCards.length}`} />
                </Stack>

                <LayoutMiniMap cards={layoutCards} />

                <Box sx={{ mt: 0.8, display: 'grid', gap: 0.55 }}>
                  {frontCards.map((item, idx) => (
                    <Paper
                      key={`${item.contact_id}-${idx}`}
                      variant="outlined"
                      sx={{ p: 0.62, borderStyle: 'dashed' }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block' }}>
                        {item.display_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {item.pinned ? '置顶 · ' : ''}{Math.round(item.x)}, {Math.round(item.y)} · {Math.round(item.width)}x{Math.round(item.height)}
                      </Typography>
                    </Paper>
                  ))}
                  {frontCards.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      当前布局为空。
                    </Typography>
                  )}
                </Box>
              </Paper>
            </>
          )}

          <Divider sx={{ my: 1.2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            最近关注线索
          </Typography>

          <Box sx={{ mt: 0.85, display: 'grid', gap: 0.7 }}>
            {visibleFocus.map((item: AgentFocusItem) => (
              <Paper
                key={`${item.message_id}-${item.source}`}
                variant="outlined"
                sx={{
                  p: 0.95,
                  borderLeft: '3px solid',
                  borderLeftColor:
                    sourceColor(item.source_label) === 'primary'
                      ? theme.palette.primary.main
                      : sourceColor(item.source_label) === 'secondary'
                      ? theme.palette.secondary.main
                      : sourceColor(item.source_label) === 'success'
                      ? theme.palette.success.main
                      : theme.palette.divider,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {item.source_label} · {item.sender} · {formatTime(item.received_at)}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 700, wordBreak: 'break-word' }}>
                  {item.title}
                </Typography>
              </Paper>
            ))}
            {focusItems.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                暂无关注线索。
              </Typography>
            )}
            {focusItems.length > 8 && (
              <Button size="small" variant="text" onClick={() => setShowAllFocus((prev) => !prev)}>
                {showAllFocus ? '收起关注线索' : `展开全部 ${focusItems.length} 条线索`}
              </Button>
            )}
          </Box>

          <Divider sx={{ my: 1.2 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            记忆条目
          </Typography>

          <Box sx={{ mt: 0.85, display: 'grid', gap: 0.7 }}>
            {visibleNotes.map((parsed) => {
              const note = parsed.note;
              const label = KIND_LABEL[note.kind] || note.kind;
              return (
                <Paper
                  key={note.id}
                  variant="outlined"
                  sx={{ p: 0.85, display: 'flex', alignItems: 'flex-start', gap: 0.9 }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Chip size="small" label={label} />
                      <Typography variant="caption" color="text.secondary">
                        {note.source ? `${normalizeSourceLabel(note.source)} · ` : ''}{formatTime(note.updated_at)}
                      </Typography>
                    </Stack>

                    {parsed.category === 'todo' && parsed.todoObject ? (
                      <Box sx={{ mt: 0.62 }}>
                        <Typography variant="body2" sx={{ mt: 0.62, fontWeight: 700 }}>
                          {compactValue(parsed.todoObject.title)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
                          {'priority' in parsed.todoObject ? `优先级 ${compactValue(parsed.todoObject.priority)} · ` : ''}
                          {'done' in parsed.todoObject
                            ? Boolean(parsed.todoObject.done)
                              ? '已完成'
                              : '未完成'
                            : ''}
                          {'due_at' in parsed.todoObject && parsed.todoObject.due_at
                            ? ` · 截止 ${compactValue(parsed.todoObject.due_at)}`
                            : ''}
                        </Typography>
                        {'detail' in parsed.todoObject && parsed.todoObject.detail ? (
                          looksLikeMarkdown(String(parsed.todoObject.detail)) ? (
                            <MarkdownPreview content={String(parsed.todoObject.detail)} compact />
                          ) : (
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.35, display: 'block', whiteSpace: 'pre-wrap' }}>
                              {compactValue(parsed.todoObject.detail)}
                            </Typography>
                          )
                        ) : null}
                      </Box>
                    ) : null}

                    {parsed.category === 'json_object' && parsed.jsonObject ? renderObjectRows(parsed.jsonObject) : null}
                    {parsed.category === 'json_array' && parsed.jsonArray ? (
                      <Box sx={{ mt: 0.62 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          JSON 数组 {parsed.jsonArray.length} 项
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.2, display: 'block' }}>
                          {compactValue(parsed.jsonArray.slice(0, 2))}
                        </Typography>
                      </Box>
                    ) : null}
                    {parsed.category === 'markdown' ? <MarkdownPreview content={note.content} /> : null}
                    {parsed.category === 'text' ? (
                      <Typography variant="body2" sx={{ mt: 0.6, whiteSpace: 'pre-wrap' }}>
                        {note.content}
                      </Typography>
                    ) : null}
                  </Box>

                  <IconButton size="small" onClick={() => onDeleteNote(note.id)}>
                    <DeleteOutlineIcon fontSize="inherit" />
                  </IconButton>
                </Paper>
              );
            })}

            {structuredNotes.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                暂无额外记忆条目。
              </Typography>
            )}

            {structuredNotes.length > 8 && (
              <Button size="small" variant="text" onClick={() => setShowAllNotes((prev) => !prev)}>
                {showAllNotes ? '收起部分条目' : `展开全部 ${structuredNotes.length} 条`}
              </Button>
            )}
          </Box>
        </>
      )}

      <Divider sx={{ my: 1.2 }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        手动校正记忆
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
