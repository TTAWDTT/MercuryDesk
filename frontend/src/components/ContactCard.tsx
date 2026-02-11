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
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
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
  scale?: number;
  onTogglePin?: (contact: Contact) => void;
  onScaleChange?: (contact: Contact, nextScale: number) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onClick,
  index,
  variant = 'standard',
  disabled = false,
  tag,
  pinned = false,
  scale = 1,
  onTogglePin,
  onScaleChange,
}) => {
  const theme = useTheme();
  const isFeature = variant === 'feature';
  const [previewImageLoadFailed, setPreviewImageLoadFailed] = React.useState(false);
  const safeScale = Math.max(0.8, Math.min(1.5, Number.isFinite(scale) ? scale : 1));

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
          borderColor: pinned ? 'primary.main' : 'divider',
          opacity: disabled ? 0.65 : 1,
          boxShadow: pinned
            ? `7px 7px 0 0 ${alpha(theme.palette.primary.main, 0.45)}`
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
                bgcolor: 'primary.main',
                color: theme.palette.mode === 'light' ? '#fff' : '#000',
                zIndex: 4,
                borderRight: '2px solid',
                borderBottom: '2px solid',
                borderColor: 'text.primary',
              }
            : undefined,
          '&:hover': {
            ...(disabled
              ? {}
              : {
                  transform: 'translate(-2px, -2px)',
                  boxShadow: `6px 6px 0 0 ${theme.palette.text.primary}`,
                }),
          }
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
              borderColor: 'divider',
              boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.25)}`,
            }}
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            data-card-control="1"
          >
            <IconButton
              size="small"
              onClick={() => onScaleChange?.(contact, Math.max(0.8, safeScale - 0.1))}
              sx={{ borderRadius: 0 }}
              aria-label="缩小卡片"
            >
              <ZoomOutIcon fontSize="inherit" />
            </IconButton>
            <Typography
              variant="caption"
              sx={{
                width: 30,
                textAlign: 'center',
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              {Math.round(safeScale * 100)}%
            </Typography>
            <IconButton
              size="small"
              onClick={() => onScaleChange?.(contact, Math.min(1.5, safeScale + 0.1))}
              sx={{ borderRadius: 0 }}
              aria-label="放大卡片"
            >
              <ZoomInIcon fontSize="inherit" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => onTogglePin?.(contact)}
              sx={{
                borderRadius: 0,
                color: pinned ? 'primary.main' : 'text.secondary',
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
                boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.3)}`
              }}
            />
          </Box>
        )}
        {contact.unread_count > 0 && (
            <Box 
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: disabled ? 8 : 136,
                    width: 12,
                    height: 12,
                    bgcolor: 'text.primary',
                    border: '2px solid',
                    borderColor: 'background.paper',
                    borderRadius: '50%',
                    zIndex: 1
                }}
            />
        )}

        <CardContent
          sx={{
            p: isFeature
              ? { xs: 3.5, md: 4 }
              : { xs: 3, md: 3.5 },
            '&:last-child': {
              pb: isFeature
                ? { xs: 3.5, md: 4 }
                : { xs: 3, md: 3.5 }
            }
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Avatar 
              src={contact.avatar_url || undefined} 
              imgProps={{ referrerPolicy: 'no-referrer' }}
              sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: theme.palette.primary.main,
                  width: isFeature ? 72 : 60,
                  height: isFeature ? 72 : 60,
                  fontWeight: 600,
                  borderRadius: 0,
                  border: '2px solid',
                  borderColor: 'divider',
                  boxShadow: `2px 2px 0 0 ${alpha(theme.palette.text.primary, 0.3)}`
              }}
            >
              {!contact.avatar_url && (contact.display_name?.[0] || <PersonIcon />)}
            </Avatar>
            <Box ml={2} overflow="hidden">
              <Typography
                variant={isFeature ? 'h5' : 'h6'}
                noWrap
                sx={{
                  fontSize: isFeature
                    ? { xs: '1.25rem', md: '1.4rem' }
                    : { xs: '1.1rem', md: '1.18rem' },
                  fontWeight: 700,
                }}
              >
                {contact.display_name}
              </Typography>
              <Typography
                variant="body2"
                color="textSecondary"
                noWrap
                sx={{ fontSize: isFeature ? { xs: '0.9rem', md: '0.95rem' } : '0.85rem' }}
              >
                {contact.handle}
              </Typography>
            </Box>
          </Box>

          <Box
            sx={{
                bgcolor: theme.palette.background.default,
                border: '1px dashed',
                borderColor: alpha(theme.palette.text.primary, 0.2),
                borderRadius: 0,
                p: isFeature ? { xs: 2.25, md: 2.75 } : 2,
                mb: isFeature ? 2.5 : 2,
            }}
          >
            {previewImageUrl && !previewImageLoadFailed && (
              <Box
                sx={{
                  borderRadius: 0,
                  overflow: 'hidden',
                  mb: isFeature ? 2 : 1.5,
                  border: '2px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  aspectRatio: isFeature ? '16 / 8.8' : '16 / 9',
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
                WebkitLineClamp: isFeature ? 2 : 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.25,
                fontSize: isFeature ? '1.06rem' : '0.92rem',
              }}
            >
              {previewTitle}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{
              display: '-webkit-box',
              WebkitLineClamp: isFeature ? 3 : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: isFeature ? { xs: '0.9rem', md: '0.95rem' } : '0.85rem',
              lineHeight: 1.7
            }}>
              {previewText}
            </Typography>
            {previewUrl && (
              <Typography
                component="a"
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="caption"
                color="primary.main"
                onClick={(event) => event.stopPropagation()}
                sx={{
                  mt: 1,
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

          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
            <Chip
              icon={getSourceIcon(contact.latest_source)}
              label={sourceLabel}
              size="small"
              sx={{
                  borderRadius: 0,
                  fontWeight: 700,
                  '& .MuiChip-icon': { color: 'inherit' }
              }}
            />
            <Typography variant="caption" color="textSecondary">
              {formattedDate}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};
