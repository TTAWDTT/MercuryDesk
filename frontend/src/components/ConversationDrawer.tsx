import React, { useEffect, useState, useRef } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import useMediaQuery from '@mui/material/useMediaQuery';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  Contact,
  Message,
  listMessages,
  markContactRead,
  agentSummarizeStream,
  agentDraftReplyStream
} from '../api';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { useTheme, alpha } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import {
  extractPreviewImageUrl,
  getPreviewDisplayText,
  parseContentPreview,
} from '../utils/contentPreview';

const URL_PATTERN = /(https?:\/\/[^\s)]+)(?=[\s)]|$)/g;

function renderTextWithLinks(text: string) {
  return text.split(URL_PATTERN).map((part, index) => {
    if (!part) return null;
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <Link
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ wordBreak: 'break-all' }}
        >
          {part}
        </Link>
      );
    }
    return <React.Fragment key={`${index}-${part.slice(0, 12)}`}>{part}</React.Fragment>;
  });
}

const MessageItem = React.memo(({ msg, index, highlight }: { msg: Message; index: number; highlight?: boolean }) => {
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const abortRef = useRef<AbortController | null>(null);
  const [summary, setSummary] = useState<string | null>(msg.summary || null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [draft, setDraft] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftAnchorEl, setDraftAnchorEl] = useState<null | HTMLElement>(null);

  // Cleanup AbortController on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Reset state if msg prop changes
  useEffect(() => {
    setSummary(msg.summary || null);
    setDraft(null);
    setIsSummarizing(false);
    setIsDrafting(false);
  }, [msg.id, msg.summary]);

  const handleSummarize = async () => {
    if (isSummarizing) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSummarizing(true);
    setSummary('');
    try {
      let text = '';
      for await (const chunk of agentSummarizeStream(msg.body_preview, controller.signal)) {
        text += chunk;
        setSummary(text);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      setSummary(prev => prev ? prev + '\n(摘要生成失败)' : '(摘要生成失败)');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDraftReply = async (tone: string) => {
    setDraftAnchorEl(null);
    if (isDrafting) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsDrafting(true);
    setDraft('');
    try {
      let text = '';
      for await (const chunk of agentDraftReplyStream(msg.body_preview, tone, controller.signal)) {
        text += chunk;
        setDraft(text);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
      setDraft(prev => prev ? prev + '\n(草稿生成失败)' : '(草稿生成失败)');
    } finally {
      setIsDrafting(false);
    }
  };

  const copyDraft = () => {
    if (draft) {
      navigator.clipboard.writeText(draft);
    }
  };

  const parsedPreview = parseContentPreview(msg.body_preview);
  const previewImageUrl = extractPreviewImageUrl(msg.body_preview);
  const previewUrl = parsedPreview?.url || null;
  const displayText = parsedPreview
    ? getPreviewDisplayText(msg.body_preview, msg.body_preview)
    : msg.body_preview;
  const displayTitle = (msg.subject || '').trim() || parsedPreview?.title || '未命名消息';

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : {
        delay: Math.min(index * 0.08, 0.5),
        duration: 0.45,
        type: 'spring',
        stiffness: 110,
        damping: 16,
      }}
    >
      <Paper
        elevation={0}
        sx={{
            '@keyframes drawerFocusPulse': {
              '0%, 100%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.008)' },
            },
            p: { xs: 1.5, md: 1.8 },
            borderRadius: 3,
            border: '1px solid',
            borderColor: highlight ? alpha(theme.palette.warning.main, 0.55) : 'divider',
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
            position: 'relative',
            overflow: 'hidden',
            animation: highlight ? 'drawerFocusPulse 860ms ease-in-out 2' : 'none',
            boxShadow:
              highlight
                ? `0 0 0 2px ${alpha(theme.palette.warning.main, 0.26)}, 0 10px 24px ${alpha(theme.palette.text.primary, 0.14)}`
                : theme.palette.mode === 'light'
                  ? '0 6px 16px rgba(20,20,19,0.08)'
                  : '0 10px 22px rgba(0,0,0,0.3)',
            '&:hover': {
                boxShadow:
                  theme.palette.mode === 'light'
                    ? '0 10px 24px rgba(20,20,19,0.12)'
                    : '0 14px 28px rgba(0,0,0,0.34)',
                borderColor: highlight ? alpha(theme.palette.warning.main, 0.58) : alpha(theme.palette.primary.main, 0.34),
            }
        }}
      >
        <Box
            sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                bgcolor: msg.is_read ? 'transparent' : 'primary.main'
            }}
        />
        <Box display="flex" justifyContent="space-between" mb={0.8} alignItems="flex-start">
            <Typography variant="subtitle2" fontWeight="800" color="textPrimary" sx={{ lineHeight: 1.2 }}>
                {msg.sender}
            </Typography>
            <Typography variant="caption" color="textSecondary" fontWeight="600" sx={{ whiteSpace: 'nowrap', ml: 1, fontSize: '0.74rem' }}>
                {format(new Date(msg.received_at), 'M月d日 HH:mm', { locale: zhCN })}
            </Typography>
        </Box>
        <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
            {msg.source}
          </Typography>
          {!msg.is_read ? (
            <Box
              component="span"
              sx={{
                px: 0.7,
                py: 0.1,
                borderRadius: 1.5,
                fontSize: '0.68rem',
                fontWeight: 700,
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.12),
              }}
            >
              未读
            </Box>
          ) : null}
        </Stack>

        <Typography variant="h6" fontSize="0.99rem" fontWeight="800" sx={{ letterSpacing: '0.01em', lineHeight: 1.35, mb: 0.9 }}>
          {displayTitle}
        </Typography>

        {(previewImageUrl || previewUrl) && (
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              p: 0.85,
              mb: 1.2,
              bgcolor: 'transparent',
              boxShadow: 'none'
            }}
          >
            {previewImageUrl && (
              <Box
                component="img"
                src={previewImageUrl}
                alt={msg.subject || '预览图'}
                loading="lazy"
                referrerPolicy="no-referrer"
                sx={{
                  width: '100%',
                  display: 'block',
                  borderRadius: 1.5,
                  objectFit: 'cover',
                  mb: previewUrl ? 0.7 : 0,
                  maxHeight: { xs: 190, md: 230 },
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              />
            )}
            {previewUrl && (
              <Link
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{
                  display: 'inline-flex',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  wordBreak: 'break-all',
                }}
              >
                查看原文
              </Link>
            )}
          </Box>
        )}

        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.52, wordBreak: 'break-word', fontSize: '0.82rem' }}
        >
          {renderTextWithLinks(displayText)}
        </Typography>

        {/* Action Buttons */}
        <Stack direction="row" spacing={0.8} mt={1.2}>
           {!summary && !isSummarizing && (
             <Button
                size="small"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleSummarize}
                sx={{
                  minHeight: 28,
                  px: 1,
                  fontSize: '0.75rem',
                  color: theme.palette.secondary.main
                }}
             >
               AI 摘要
             </Button>
           )}
           <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={(e) => setDraftAnchorEl(e.currentTarget)}
              sx={{
                minHeight: 28,
                px: 1,
                fontSize: '0.75rem',
                color: theme.palette.text.secondary
              }}
           >
             草拟回复
           </Button>
           <Menu
             anchorEl={draftAnchorEl}
             open={Boolean(draftAnchorEl)}
             onClose={() => setDraftAnchorEl(null)}
             slotProps={{
              paper: {
                sx: {
                  p: 0.35,
                  borderRadius: 2,
                },
              },
             }}
           >
             <MenuItem onClick={() => handleDraftReply('friendly')}>友好语气</MenuItem>
             <MenuItem onClick={() => handleDraftReply('formal')}>正式语气</MenuItem>
             <MenuItem onClick={() => handleDraftReply('casual')}>随意语气</MenuItem>
           </Menu>
        </Stack>

        {/* Summary Section */}
        {(summary || isSummarizing) && (
          <Box
            mt={1.2}
            p={1.35}
            bgcolor={alpha(theme.palette.primary.main, theme.palette.mode === 'light' ? 0.07 : 0.13)}
            borderRadius={2}
            display="flex"
            gap={1.1}
            sx={{
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.3),
            }}
          >
             <AutoAwesomeIcon sx={{ color: 'primary.main', fontSize: 16, mt: 0.1 }} />
             <Box flexGrow={1}>
                 <Typography
                    variant="caption"
                    fontWeight="700"
                    color="primary.main"
                    gutterBottom
                    display="block"
                    sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                 >
                     AI Summary {isSummarizing && <CircularProgress size={10} thickness={6} sx={{ ml: 1, color: 'primary.main' }} />}
                 </Typography>
                 <Typography
                    variant="body2"
                    color="text.primary"
                    sx={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        fontSize: '0.8rem',
                        fontFamily: theme.typography.body1.fontFamily
                    }}
                 >
                     {summary}
                 </Typography>
             </Box>
          </Box>
        )}

        {/* Draft Section */}
        {(draft || isDrafting) && (
          <Box
            mt={1.2}
            p={1.35}
            bgcolor={alpha(theme.palette.secondary.main, theme.palette.mode === 'light' ? 0.08 : 0.14)}
            borderRadius={2}
            display="flex"
            gap={1.1}
            sx={{
                border: '1px solid',
                borderColor: alpha(theme.palette.secondary.main, 0.28),
            }}
          >
             <EditIcon sx={{ color: 'secondary.main', fontSize: 16, mt: 0.1 }} />
             <Box flexGrow={1}>
                 <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.6}>
                    <Typography
                        variant="caption"
                        fontWeight="700"
                        color="secondary.main"
                        sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    >
                        Draft Reply {isDrafting && <CircularProgress size={10} thickness={6} sx={{ ml: 1 }} />}
                    </Typography>
                    {draft && !isDrafting && (
                        <IconButton size="small" onClick={copyDraft} title="复制草稿" aria-label="复制草稿" sx={{ color: 'text.secondary' }}>
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    )}
                 </Box>
                 <Typography
                    variant="body2"
                    color="text.primary"
                    sx={{
                        whiteSpace: 'pre-wrap',
                        fontFamily: theme.typography.body1.fontFamily,
                        fontSize: '0.8rem',
                        lineHeight: 1.5
                    }}
                 >
                     {draft}
                 </Typography>
             </Box>
          </Box>
        )}

      </Paper>
    </motion.div>
  );
});

interface ConversationDrawerProps {
  open: boolean;
  onClose: () => void;
  contact: Contact | null;
  focusMessageId?: number | null;
}

export const ConversationDrawer: React.FC<ConversationDrawerProps> = ({ open, onClose, contact, focusMessageId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<number | null>(null);
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (open && contact) {
      setLoading(true);
      // Mark as read immediately when opening
      if (contact.unread_count > 0) {
          markContactRead(contact.id).catch(console.error);
      }

      listMessages({ contactId: contact.id, limit: 50 })
        .then(data => { if (!cancelled) setMessages(data); })
        .catch(console.error)
        .finally(() => { if (!cancelled) setLoading(false); });
    } else {
      setMessages([]);
    }
    return () => { cancelled = true; };
  }, [open, contact?.id]);

  useEffect(() => {
    if (!open || !focusMessageId || messages.length === 0) return;
    if (!messages.some((msg) => msg.id === focusMessageId)) return;
    setHighlightMessageId(focusMessageId);
    const clearTimer = window.setTimeout(() => setHighlightMessageId(null), 2600);
    const frame = window.requestAnimationFrame(() => {
      const host = bodyRef.current;
      if (!host) return;
      const target = host.querySelector(`[data-message-id="${focusMessageId}"]`) as HTMLElement | null;
      target?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'center' });
    });
    return () => {
      window.clearTimeout(clearTimer);
      window.cancelAnimationFrame(frame);
    };
  }, [focusMessageId, messages, open, prefersReducedMotion]);

  if (!contact) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
            width: { xs: '100%', sm: 600, md: 700 },
            m: { xs: 0, md: 1.5 },
            height: { xs: '100%', md: 'calc(100% - 32px)' },
            borderRadius: { xs: 0, md: 4 },
            boxShadow:
              theme.palette.mode === 'light'
                ? '0 18px 36px rgba(20,20,19,0.16)'
                : '0 20px 40px rgba(0,0,0,0.42)',
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            backgroundImage: 'none',
        },
      }}
    >
      <Box
        p={{ xs: 1.4, md: 1.7 }}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{
            bgcolor: 'background.paper',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            borderBottom: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(8px)',
            background: alpha(theme.palette.background.paper, 0.88),
        }}
      >
        <Box display="flex" alignItems="center">
          <Avatar
            src={contact.avatar_url || undefined}
            imgProps={{ referrerPolicy: 'no-referrer' }}
            sx={{
                mr: 1.2,
                width: 40,
                height: 40,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main
            }}
          >
            {contact.display_name?.[0]}
          </Avatar>
          <Box>
             <Typography variant="subtitle1" lineHeight={1.2} sx={{ fontWeight: 700 }}>{contact.display_name}</Typography>
             <Typography variant="caption" color="textSecondary">{contact.handle}</Typography>
             {focusMessageId ? (
               <Typography variant="caption" sx={{ display: 'block', color: 'warning.main', fontWeight: 700 }}>
                 焦点消息 #{focusMessageId}
               </Typography>
             ) : null}
          </Box>
        </Box>
        <IconButton onClick={onClose} aria-label="关闭详情面板" sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        ref={bodyRef}
        p={{ xs: 1.2, md: 1.6 }}
        flexGrow={1}
        bgcolor={alpha(theme.palette.background.default, 0.7)}
        sx={{
          overflowY: 'auto',
          scrollBehavior: prefersReducedMotion ? 'auto' : 'smooth',
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" p={8}>
            <CircularProgress size={32} />
          </Box>
        ) : messages.length === 0 ? (
          <Box textAlign="center" mt={8}>
              <Typography variant="body1" color="textSecondary">暂无消息</Typography>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={1.5}>
            <AnimatePresence>
            {messages.map((msg, i) => (
              <Box key={msg.id} data-message-id={msg.id}>
                <MessageItem msg={msg} index={i} highlight={highlightMessageId === msg.id} />
              </Box>
            ))}
            </AnimatePresence>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};
