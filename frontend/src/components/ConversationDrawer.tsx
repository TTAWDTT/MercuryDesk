import React, { useEffect, useState } from 'react';
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
import Chip from '@mui/material/Chip';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import EditIcon from '@mui/icons-material/Edit';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
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

const MessageItem = ({ msg, index }: { msg: Message; index: number }) => {
  const theme = useTheme();
  const [summary, setSummary] = useState<string | null>(msg.summary || null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [draft, setDraft] = useState<string | null>(null);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftAnchorEl, setDraftAnchorEl] = useState<null | HTMLElement>(null);

  // Reset state if msg prop changes (though keys usually handle this)
  useEffect(() => {
    setSummary(msg.summary || null);
    setDraft(null);
    setIsSummarizing(false);
    setIsDrafting(false);
  }, [msg.id, msg.summary]);

  const handleSummarize = async () => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setSummary(''); // Clear previous if any
    try {
      let text = '';
      for await (const chunk of agentSummarizeStream(msg.body || msg.body_preview)) {
        text += chunk;
        setSummary(text);
      }
    } catch (err) {
      console.error(err);
      setSummary(prev => prev ? prev + '\n(摘要生成失败)' : '(摘要生成失败)');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleDraftReply = async (tone: string) => {
    setDraftAnchorEl(null);
    if (isDrafting) return;
    setIsDrafting(true);
    setDraft('');
    try {
      let text = '';
      for await (const chunk of agentDraftReplyStream(msg.body || msg.body_preview, tone)) {
        text += chunk;
        setDraft(text);
      }
    } catch (err) {
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Paper
        elevation={0}
        sx={{
            p: { xs: 3, md: 3.5 },
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            transition: 'box-shadow 0.2s',
            position: 'relative',
            overflow: 'hidden',
            '&:hover': {
                boxShadow: '0 8px 20px rgba(0,0,0,0.08)'
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
        <Box display="flex" justifyContent="space-between" mb={1.5} alignItems="flex-start">
            <Typography variant="subtitle2" fontWeight="bold" color="textPrimary">
                {msg.sender}
            </Typography>
            <Typography variant="caption" color="textSecondary" sx={{ whiteSpace: 'nowrap', ml: 1 }}>
                {format(new Date(msg.received_at), 'M月d日 HH:mm', { locale: zhCN })}
            </Typography>
        </Box>

        <Typography variant="h6" gutterBottom fontSize="1.05rem" fontWeight="600">
          {displayTitle}
        </Typography>

        {(previewImageUrl || previewUrl) && (
          <Box
            sx={{
              border: '1px solid',
              borderColor: alpha(theme.palette.primary.main, 0.2),
              borderRadius: 3,
              p: 1.5,
              mb: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
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
                  borderRadius: 2,
                  objectFit: 'cover',
                  mb: previewUrl ? 1 : 0,
                  maxHeight: { xs: 220, md: 280 },
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
                  fontSize: '0.82rem',
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
          sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, wordBreak: 'break-word' }}
        >
          {renderTextWithLinks(displayText)}
        </Typography>

        {/* Action Buttons */}
        <Stack direction="row" spacing={1} mt={2}>
           {!summary && !isSummarizing && (
             <Button
                size="small"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleSummarize}
                sx={{ color: theme.palette.secondary.main }}
             >
               AI 摘要
             </Button>
           )}
           <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={(e) => setDraftAnchorEl(e.currentTarget)}
              sx={{ color: theme.palette.text.secondary }}
           >
             草拟回复
           </Button>
           <Menu
             anchorEl={draftAnchorEl}
             open={Boolean(draftAnchorEl)}
             onClose={() => setDraftAnchorEl(null)}
           >
             <MenuItem onClick={() => handleDraftReply('friendly')}>✨ 友好语气</MenuItem>
             <MenuItem onClick={() => handleDraftReply('formal')}>👔 正式语气</MenuItem>
             <MenuItem onClick={() => handleDraftReply('casual')}>👋 随意语气</MenuItem>
           </Menu>
        </Stack>

        {/* Summary Section */}
        {(summary || isSummarizing) && (
          <Box
            mt={2}
            p={2}
            bgcolor={alpha(theme.palette.secondary.main, 0.04)}
            borderRadius={2}
            border={`1px solid ${alpha(theme.palette.secondary.main, 0.1)}`}
            display="flex"
            gap={1.5}
            position="relative"
          >
             <AutoAwesomeIcon sx={{ color: theme.palette.secondary.main, fontSize: 20, mt: 0.3 }} />
             <Box flexGrow={1}>
                 <Typography variant="caption" fontWeight="bold" color="secondary" gutterBottom display="block">
                     AI 摘要 {isSummarizing && <CircularProgress size={10} thickness={6} sx={{ ml: 1 }} />}
                 </Typography>
                 <Typography variant="body2" fontSize="0.875rem" color="textPrimary" sx={{ whiteSpace: 'pre-wrap' }}>
                     {summary}
                 </Typography>
             </Box>
          </Box>
        )}

        {/* Draft Section */}
        {(draft || isDrafting) && (
          <Box
            mt={2}
            p={2}
            bgcolor={alpha(theme.palette.grey[500], 0.04)}
            borderRadius={2}
            border={`1px solid ${alpha(theme.palette.grey[500], 0.1)}`}
            display="flex"
            gap={1.5}
          >
             <EditIcon sx={{ color: theme.palette.text.secondary, fontSize: 20, mt: 0.3 }} />
             <Box flexGrow={1}>
                 <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.5}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">
                        草拟回复 {isDrafting && <CircularProgress size={10} thickness={6} sx={{ ml: 1 }} />}
                    </Typography>
                    {draft && !isDrafting && (
                        <IconButton size="small" onClick={copyDraft} title="复制">
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    )}
                 </Box>
                 <Typography variant="body2" fontSize="0.875rem" color="textPrimary" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                     {draft}
                 </Typography>
             </Box>
          </Box>
        )}

      </Paper>
    </motion.div>
  );
};

interface ConversationDrawerProps {
  open: boolean;
  onClose: () => void;
  contact: Contact | null;
}

export const ConversationDrawer: React.FC<ConversationDrawerProps> = ({ open, onClose, contact }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (open && contact) {
      setLoading(true);
      // Mark as read immediately when opening
      if (contact.unread_count > 0) {
          markContactRead(contact.id).catch(console.error);
      }

      listMessages({ contactId: contact.id, limit: 50 })
        .then(setMessages)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setMessages([]);
    }
  }, [open, contact]);

  if (!contact) return null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
            width: { xs: '100%', sm: 600, md: 700 },
            m: { xs: 0, md: 2 },
            height: { xs: '100%', md: 'calc(100% - 32px)' },
            borderRadius: { xs: 0, md: 4 },
            boxShadow: '-8px 0 24px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            border: 'none',
        },
      }}
    >
      <Box
        p={2.5}
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
            backdropFilter: 'blur(10px)',
            background: alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Box display="flex" alignItems="center">
          <Avatar
            src={contact.avatar_url || undefined}
            imgProps={{ referrerPolicy: 'no-referrer' }}
            sx={{
                mr: 2,
                width: 48,
                height: 48,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main
            }}
          >
            {contact.display_name?.[0]}
          </Avatar>
          <Box>
             <Typography variant="h6" lineHeight={1.2}>{contact.display_name}</Typography>
             <Typography variant="caption" color="textSecondary">{contact.handle}</Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        p={3}
        flexGrow={1}
        bgcolor="background.default"
        sx={{ overflowY: 'auto' }}
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
          <Box display="flex" flexDirection="column" gap={3}>
            <AnimatePresence>
            {messages.map((msg, i) => (
              <MessageItem key={msg.id} msg={msg} index={i} />
            ))}
            </AnimatePresence>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};

