import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import PushPinIcon from '@mui/icons-material/PushPin';
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
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export const ContactCard: React.FC<ContactCardProps> = ({
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
}) => {
  const theme = useTheme();
  const isFeature = variant === 'feature';
  const isLight = theme.palette.mode === 'light';
  const [previewImageLoadFailed, setPreviewImageLoadFailed] = React.useState(false);

  const safeWidth = Math.max(160, Math.round(cardWidth ?? (isFeature ? 340 : 312)));
  const safeHeight = Math.max(140, Math.round(cardHeight ?? (isFeature ? 340 : 316)));
  const aspectRatio = safeWidth / Math.max(1, safeHeight);
  const isTiny = safeWidth < 210 || safeHeight < 190;
  const isCompact = safeWidth < 260 || safeHeight < 250;
  const isWideAndFlat = aspectRatio > 1.45 && safeHeight < 280;
  const avatarSize = clamp(Math.min(safeWidth * 0.22, safeHeight * 0.24), isTiny ? 34 : 44, isFeature ? 76 : 66);
  const titleClamp = isTiny ? 1 : isCompact ? 2 : isFeature ? 2 : 1;
  const previewClamp = isTiny ? 1 : isCompact ? 2 : isWideAndFlat ? 2 : isFeature ? 4 : 3;
  const showHandle = safeWidth >= 225;
  const showSourceAndTime = safeHeight >= 185;
  const showPreviewBlock = safeHeight >= 160;
  const showPreviewImage = Boolean(!isTiny && safeHeight >= 240 && !isWideAndFlat);
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
          border: '2px solid',
          borderColor: pinned ? (isLight ? '#000' : 'primary.main') : 'divider',
          opacity: disabled ? 0.65 : 1,
          boxShadow: pinned
            ? isLight
              ? '8px 8px 0 0 #000'
              : `8px 8px 0 0 ${alpha(theme.palette.primary.main, 0.55)}`
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
                borderRight: '2px solid',
                borderBottom: '2px solid',
                borderColor: isLight ? '#fff' : 'text.primary',
              }
            : undefined,
          '&:hover': {
            ...(disabled
              ? {}
              : {
                  transform: 'translate(-2px, -2px)',
                  boxShadow: pinned && isLight
                    ? '8px 8px 0 0 #000'
                    : `6px 6px 0 0 ${theme.palette.text.primary}`,
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
              boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.25)}`,
            }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            data-card-control="1"
          >
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
                borderRadius: 0,
                fontWeight: 700,
                letterSpacing: '0.02em',
                bgcolor: 'background.paper',
                border: '2px solid',
                borderColor: 'divider',
                boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.3)}`,
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
            '&:last-child': {
              pb: contentPadding,
            },
          }}
        >
          <Box display="flex" alignItems="center" mb={isTiny ? 1 : 1.8}>
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
                boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.3)}`,
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
                borderRadius: 0,
                p: isTiny ? 1 : isCompact ? 1.35 : isFeature ? 2.4 : 1.8,
                mb: showSourceAndTime ? 1.8 : 0,
                minHeight: 0,
              }}
            >
              {showPreviewImage && previewImageUrl && !previewImageLoadFailed && (
                <Box
                  sx={{
                    borderRadius: 0,
                    overflow: 'hidden',
                    mb: isFeature ? 1.8 : 1.3,
                    border: '2px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    aspectRatio: isWideAndFlat ? '16 / 7.8' : isFeature ? '16 / 8.8' : '16 / 9',
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
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </Box>
              )}

              <Typography
                variant={isFeature ? 'h6' : 'subtitle2'}
                fontWeight={700}
                gutterBottom
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: titleClamp,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  lineHeight: 1.25,
                  fontSize: isTiny ? '0.86rem' : isFeature ? '1.04rem' : '0.92rem',
                }}
              >
                {previewTitle}
              </Typography>

              <Typography
                variant="body2"
                color="textSecondary"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: previewClamp,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: isTiny ? '0.76rem' : isFeature ? { xs: '0.87rem', md: '0.92rem' } : '0.84rem',
                  lineHeight: 1.6,
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
                    '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  查看原文
                </Typography>
              )}
            </Box>
          )}

          {showSourceAndTime && (
            <Box display="flex" justifyContent="space-between" alignItems="center" gap={1.4}>
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
