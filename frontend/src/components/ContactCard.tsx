import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import PushPinIcon from '@mui/icons-material/PushPin';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SummarizeIcon from '@mui/icons-material/Summarize';
import ReplyIcon from '@mui/icons-material/Reply';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Contact } from '../api';
import { motion } from 'framer-motion';
import { useTheme, alpha } from '@mui/material/styles';
import {
  extractPreviewImageUrl,
  getPreviewDisplayText,
  parseContentPreview,
} from '../utils/contentPreview';

interface ContactCardProps {
  contact: Contact;
  onClick: (contact: Contact) => void;
  index: number;
  variant?: 'standard' | 'feature';
  disabled?: boolean;
  tag?: string;
  pinned?: boolean;
  cardWidth?: number;
  cardHeight?: number;
  onTogglePin?: (contact: Contact) => void;
  onQuickAction?: (contact: Contact, action: 'summarize' | 'draft' | 'todo') => void;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function areEqualContactCardProps(prev: ContactCardProps, next: ContactCardProps): boolean {
  return (
    prev.contact === next.contact &&
    prev.index === next.index &&
    prev.variant === next.variant &&
    prev.disabled === next.disabled &&
    prev.tag === next.tag &&
    prev.pinned === next.pinned &&
    prev.cardWidth === next.cardWidth &&
    prev.cardHeight === next.cardHeight &&
    prev.onClick === next.onClick &&
    prev.onTogglePin === next.onTogglePin &&
    prev.onQuickAction === next.onQuickAction
  );
}

const ContactCardView: React.FC<ContactCardProps> = ({
  contact,
  onClick,
  index,
  variant = 'standard',
  disabled = false,
  tag,
  pinned = false,
  cardWidth,
  cardHeight,
  onTogglePin,
  onQuickAction,
}) => {
  const theme = useTheme();
  const isFeature = variant === 'feature';
  const isLight = theme.palette.mode === 'light';
  const [previewImageLoadFailed, setPreviewImageLoadFailed] = React.useState(false);
  const [actionAnchor, setActionAnchor] = React.useState<null | HTMLElement>(null);

  const safeWidth = Math.max(160, Math.round(cardWidth ?? (isFeature ? 340 : 312)));
  const safeHeight = Math.max(140, Math.round(cardHeight ?? (isFeature ? 340 : 316)));
  const isTiny = safeWidth < 210 || safeHeight < 190;
  const isCompact = safeWidth < 260 || safeHeight < 250;
  const avatarSize = clamp(Math.min(safeWidth * 0.22, safeHeight * 0.24), isTiny ? 34 : 44, isFeature ? 76 : 66);
  const showHandle = safeWidth >= 225;
  const showSourceAndTime = safeHeight >= 185;
  const showPreviewBlock = safeHeight >= 140;
  const contentPadding = isTiny ? 1.3 : isCompact ? 1.8 : isFeature ? 2.8 : 2.25;

  const getSourceIcon = (source?: string | null) => {
    if (!source) return <EmailIcon fontSize="small" />;
    const normalized = source.toLowerCase();
    if (normalized.includes('github')) return <GitHubIcon fontSize="small" />;
    if (normalized.includes('rss')) return <RssFeedIcon fontSize="small" />;
    if (normalized === 'x' || normalized.includes('x/')) return <AlternateEmailIcon fontSize="small" />;
    if (normalized.includes('bilibili')) return <PersonIcon fontSize="small" />;
    return <EmailIcon fontSize="small" />;
  };

  const formattedDate = contact.last_message_at
    ? formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: true, locale: zhCN })
    : '';

  const sourceLabel = (() => {
    const src = (contact.latest_source || 'email').toLowerCase();
    if (src.includes('github')) return 'GitHub';
    if (src.includes('rss')) return 'Blog/RSS';
    if (src === 'x' || src.includes('x/')) return 'X';
    if (src.includes('bilibili')) return 'Bilibili';
    if (src.includes('mock')) return '演示';
    return '邮件';
  })();

  const parsedPreview = React.useMemo(
    () => parseContentPreview(contact.latest_preview),
    [contact.latest_preview]
  );

  const previewTitle = React.useMemo(() => {
    const subject = (contact.latest_subject || '').trim();
    const parsedTitle = (parsedPreview?.title || '').trim();
    const normalizedSubject = subject.toLowerCase();
    const isGenericSubject = !subject || ['新内容更新', 'github notification', 'notification'].includes(normalizedSubject);
    if (isGenericSubject && parsedTitle) return parsedTitle;
    return subject || parsedTitle || '暂无消息';
  }, [contact.latest_subject, parsedPreview?.title]);

  const previewText = React.useMemo(
    () => getPreviewDisplayText(contact.latest_preview, '...'),
    [contact.latest_preview]
  );

  const previewImageUrl = React.useMemo(
    () => extractPreviewImageUrl(contact.latest_preview) || extractPreviewImageUrl(contact.latest_subject),
    [contact.latest_preview, contact.latest_subject]
  );
  const previewUrl = parsedPreview?.url || null;
  const showPreviewImage = Boolean(previewImageUrl && !previewImageLoadFailed);

  React.useEffect(() => {
    setPreviewImageLoadFailed(false);
  }, [previewImageUrl, contact.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
      style={{ height: '100%' }}
    >
      <Card
        onClick={disabled ? undefined : () => onClick(contact)}
        sx={{
          cursor: disabled ? 'default' : 'pointer',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid',
          borderColor: pinned ? (isLight ? '#000' : 'primary.main') : 'divider',
          opacity: disabled ? 0.65 : 1,
          boxShadow: pinned
            ? isLight
              ? '0 10px 24px rgba(17,20,24,0.18)'
              : `0 12px 28px ${alpha(theme.palette.primary.main, 0.35)}`
            : undefined,
          '&::before': pinned
            ? {
                content: '"置顶"',
                position: 'absolute',
                left: 0,
                top: 0,
                px: 1,
                py: 0.25,
                fontSize: '0.7rem',
                fontWeight: 900,
                letterSpacing: '0.08em',
                bgcolor: isLight ? '#000' : 'primary.main',
                color: isLight ? '#fff' : theme.palette.getContrastText(theme.palette.primary.main),
                zIndex: 4,
                borderBottomRightRadius: 8,
              }
            : undefined,
          '&:hover': {
            ...(disabled
              ? {}
              : {
                  transform: 'translateY(-2px)',
                  boxShadow: `0 10px 24px ${alpha(theme.palette.text.primary, 0.18)}`,
                }),
          },
        }}
      >
        {!disabled && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              bgcolor: alpha(theme.palette.background.paper, 0.94),
              border: '1px solid',
              borderColor: pinned && isLight ? '#000' : 'divider',
              boxShadow: `0 2px 10px ${alpha(theme.palette.text.primary, 0.15)}`,
            }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            data-card-control="1"
          >
            <IconButton
              size="small"
              onClick={(event) => setActionAnchor(event.currentTarget)}
              sx={{
                borderRadius: 0,
                border: '1px solid',
                borderColor: isLight ? '#000' : 'divider',
                color: 'text.secondary',
                bgcolor: isLight ? '#fff' : alpha(theme.palette.background.default, 0.5),
                '&:hover': {
                  bgcolor: isLight ? '#f2f2f2' : alpha(theme.palette.background.default, 0.8),
                },
              }}
              aria-label="卡片动作"
            >
              <AutoAwesomeIcon fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onTogglePin?.(contact)}
              sx={{
                borderRadius: 0,
                border: '1px solid',
                borderColor: pinned ? (isLight ? '#000' : 'primary.main') : (isLight ? '#000' : 'divider'),
                color: pinned ? (isLight ? '#fff' : 'primary.main') : 'text.secondary',
                bgcolor: pinned ? (isLight ? '#000' : alpha(theme.palette.primary.main, 0.12)) : (isLight ? '#fff' : alpha(theme.palette.background.default, 0.5)),
                '&:hover': {
                  bgcolor: pinned
                    ? (isLight ? '#111' : alpha(theme.palette.primary.main, 0.2))
                    : (isLight ? '#f2f2f2' : alpha(theme.palette.background.default, 0.8)),
                },
              }}
              aria-label={pinned ? '取消置顶' : '置顶卡片'}
            >
              <PushPinIcon fontSize="inherit" />
            </IconButton>
          </Box>
        )}
        <Menu
          anchorEl={actionAnchor}
          open={Boolean(actionAnchor)}
          onClose={() => setActionAnchor(null)}
          onClick={(event) => event.stopPropagation()}
          slotProps={{ paper: { sx: { borderRadius: 0, border: '2px solid', borderColor: 'text.primary' } } }}
        >
          <MenuItem
            onClick={() => {
              setActionAnchor(null);
              onQuickAction?.(contact, 'summarize');
            }}
          >
            <ListItemIcon>
              <SummarizeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>快速总结</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setActionAnchor(null);
              onQuickAction?.(contact, 'draft');
            }}
          >
            <ListItemIcon>
              <ReplyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>生成回复草稿</ListItemText>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setActionAnchor(null);
              onQuickAction?.(contact, 'todo');
            }}
          >
            <ListItemIcon>
              <PlaylistAddCheckIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>加入待办跟进</ListItemText>
          </MenuItem>
        </Menu>

        {tag && (
          <Box
            sx={{
              position: 'absolute',
              top: 14,
              left: 14,
              zIndex: 1,
            }}
          >
            <Chip
              label={tag}
              size="small"
              variant="outlined"
              sx={{
                borderRadius: 999,
                fontWeight: 700,
                letterSpacing: '0.02em',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: 'none',
              }}
            />
          </Box>
        )}

        {contact.unread_count > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 52,
              width: 12,
              height: 12,
              bgcolor: 'text.primary',
                border: '2px solid',
                borderColor: 'background.paper',
                borderRadius: '50%',
              zIndex: 1,
            }}
          />
        )}

        <CardContent
          sx={{
            p: contentPadding,
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            '&:last-child': {
              pb: contentPadding,
            },
          }}
        >
          <Box display="flex" alignItems="center" mb={isTiny ? 1 : 1.8} sx={{ flex: '0 0 auto' }}>
            <Avatar
              src={contact.avatar_url || undefined}
              imgProps={{ referrerPolicy: 'no-referrer' }}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
                width: avatarSize,
                height: avatarSize,
                fontWeight: 600,
                borderRadius: 0,
                border: '2px solid',
                borderColor: 'divider',
                boxShadow: 'none',
              }}
            >
              {!contact.avatar_url && (contact.display_name?.[0] || <PersonIcon />)}
            </Avatar>
            <Box ml={1.3} overflow="hidden">
              <Typography
                variant={isFeature && !isCompact ? 'h5' : 'h6'}
                noWrap
                sx={{
                  fontSize: isTiny
                    ? '0.92rem'
                    : isCompact
                    ? '1.02rem'
                    : isFeature
                    ? { xs: '1.22rem', md: '1.36rem' }
                    : { xs: '1.08rem', md: '1.16rem' },
                  fontWeight: 700,
                }}
              >
                {contact.display_name}
              </Typography>
              {showHandle && (
                <Typography
                  variant="body2"
                  color="textSecondary"
                  noWrap
                  sx={{ fontSize: isTiny ? '0.72rem' : isFeature ? { xs: '0.84rem', md: '0.9rem' } : '0.82rem' }}
                >
                  {contact.handle}
                </Typography>
              )}
            </Box>
          </Box>

          {showPreviewBlock && (
            <Box
              sx={{
                bgcolor: theme.palette.background.default,
                border: '1px dashed',
                borderColor: alpha(theme.palette.text.primary, 0.2),
                borderRadius: 1.5,
                p: isTiny ? 1 : isCompact ? 1.35 : isFeature ? 2.4 : 1.8,
                mb: showSourceAndTime ? 1.8 : 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              <Box sx={{ minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
                {showPreviewImage && previewImageUrl && (
                  <Box
                    sx={{
                      borderRadius: 0,
                      mb: isFeature ? 1.8 : 1.3,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: alpha(theme.palette.text.primary, 0.06),
                      flexShrink: 0,
                    }}
                  >
                    <Box
                      component="img"
                      src={previewImageUrl}
                      alt={contact.latest_subject || `${contact.display_name} 预览图`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setPreviewImageLoadFailed(true)}
                      sx={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        bgcolor: 'background.paper',
                      }}
                    />
                  </Box>
                )}

                <Typography
                  variant={isFeature ? 'h6' : 'subtitle2'}
                  fontWeight={700}
                  gutterBottom
                  sx={{
                    lineHeight: 1.25,
                    fontSize: isTiny ? '0.86rem' : isFeature ? '1.04rem' : '0.92rem',
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {previewTitle}
                </Typography>

                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{
                    fontSize: isTiny ? '0.76rem' : isFeature ? { xs: '0.87rem', md: '0.92rem' } : '0.84rem',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {previewText}
                </Typography>

                {previewUrl && !isTiny && (
                  <Typography
                    component="a"
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="caption"
                    color="primary.main"
                    onClick={(event) => event.stopPropagation()}
                    sx={{
                      mt: 0.8,
                      display: 'inline-flex',
                      textDecoration: 'none',
                      fontWeight: 700,
                      flex: '0 0 auto',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    查看原文
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {showSourceAndTime && (
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={1.4} sx={{ flex: '0 0 auto' }}>
              <Chip
                icon={getSourceIcon(contact.latest_source)}
                label={sourceLabel}
                size="small"
                sx={{
                  borderRadius: 0,
                  fontWeight: 700,
                  maxWidth: Math.max(110, safeWidth - 165),
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                  '& .MuiChip-icon': { color: 'inherit' },
                }}
              />
              <Typography variant="caption" color="textSecondary" noWrap>
                {formattedDate}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const ContactCard = React.memo(ContactCardView, areEqualContactCardProps);
