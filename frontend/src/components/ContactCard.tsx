import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
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
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onClick,
  index,
  variant = 'standard',
  disabled = false,
  tag,
}) => {
  const theme = useTheme();
  const isFeature = variant === 'feature';
  const [previewImageLoadFailed, setPreviewImageLoadFailed] = React.useState(false);

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

  const sourceAccent = (() => {
    const src = (contact.latest_source || 'email').toLowerCase();
    if (src.includes('github')) return theme.palette.info.main;
    if (src === 'x' || src.includes('x/')) return '#4F7DFF';
    if (src.includes('bilibili')) return '#3AA8FF';
    if (src.includes('rss')) return theme.palette.warning.main;
    return theme.palette.primary.main;
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
          border: '1px solid',
          borderColor: alpha(sourceAccent, 0.24),
          background: `
            linear-gradient(156deg, ${alpha(theme.palette.background.paper, 0.98)} 0%, ${alpha(theme.palette.background.default, 0.94)} 100%),
            radial-gradient(circle at 88% 14%, ${alpha(sourceAccent, theme.palette.mode === 'dark' ? 0.24 : 0.16)} 0%, transparent 35%)
          `,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `repeating-linear-gradient(132deg, transparent 0 11px, ${alpha(sourceAccent, 0.04)} 11px 12px)`,
            opacity: theme.palette.mode === 'dark' ? 0.55 : 0.34,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: 4,
            background: `linear-gradient(90deg, ${alpha(sourceAccent, 0.95)} 0%, ${alpha(sourceAccent, 0.2)} 58%, transparent 100%)`,
          },
          '&:hover': {
            ...(disabled
              ? {}
              : {
                  transform: isFeature ? 'translateY(-4px) scale(1.004)' : 'translateY(-5px) scale(1.006)',
                  borderColor: alpha(sourceAccent, 0.58),
                  boxShadow: `0 16px 38px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.45 : 0.18)}`,
                }),
          }
        }}
      >
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
                borderRadius: '999px',
                fontWeight: 700,
                letterSpacing: '0.02em',
                bgcolor: alpha(theme.palette.background.paper, 0.85),
                backdropFilter: 'blur(10px)',
              }}
            />
          </Box>
        )}
        {contact.unread_count > 0 && (
            <Box 
                sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    boxShadow: '0 0 0 2px ' + theme.palette.background.paper,
                    zIndex: 1
                }}
            />
        )}

        <CardContent
          sx={{
            position: 'relative',
            zIndex: 1,
            p: isFeature ? { xs: 3.5, md: 4 } : { xs: 3, md: 3.5 },
            '&:last-child': { pb: isFeature ? { xs: 3.5, md: 4 } : { xs: 3, md: 3.5 } }
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Box sx={{ position: 'relative' }}>
              <Avatar 
                src={contact.avatar_url || undefined} 
                sx={{ 
                    bgcolor: alpha(sourceAccent, 0.12), 
                    color: sourceAccent,
                    width: isFeature ? 72 : 60, 
                    height: isFeature ? 72 : 60,
                    fontWeight: 700,
                    borderRadius: isFeature ? '16px' : '14px',
                    border: '1px solid',
                    borderColor: alpha(sourceAccent, 0.32),
                    boxShadow: `0 8px 20px ${alpha(sourceAccent, 0.24)}`,
                }}
              >
                {!contact.avatar_url && (contact.display_name?.[0] || <PersonIcon />)}
              </Avatar>
              <Box
                sx={{
                  position: 'absolute',
                  right: -4,
                  bottom: -4,
                  width: 24,
                  height: 24,
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.background.paper, 0.95),
                  color: sourceAccent,
                  border: '1px solid',
                  borderColor: alpha(sourceAccent, 0.5),
                  boxShadow: `0 5px 10px ${alpha(sourceAccent, 0.26)}`,
                }}
              >
                {getSourceIcon(contact.latest_source)}
              </Box>
            </Box>
            <Box ml={2} overflow="hidden">
              <Typography
                variant={isFeature ? 'h5' : 'h6'}
                noWrap
                sx={{
                  fontSize: isFeature ? { xs: '1.25rem', md: '1.4rem' } : { xs: '1.1rem', md: '1.18rem' },
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
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
            {isFeature && (
              <AutoAwesomeRoundedIcon
                sx={{
                  ml: 'auto',
                  color: alpha(sourceAccent, 0.72),
                  fontSize: 20,
                }}
              />
            )}
          </Box>

          <Box 
            sx={{ 
                p: isFeature ? { xs: 2.25, md: 2.75 } : 2, 
                bgcolor: alpha(theme.palette.action.hover, 0.48), 
                borderRadius: '16px',
                mb: isFeature ? 2.5 : 2,
                border: '1px solid',
                borderColor: alpha(sourceAccent, 0.16),
            }}
          >
            {previewImageUrl && !previewImageLoadFailed && (
              <Box
                sx={{
                  borderRadius: '12px',
                  overflow: 'hidden',
                  mb: isFeature ? 2 : 1.5,
                  border: '1px solid',
                  borderColor: alpha(sourceAccent, 0.3),
                  bgcolor: alpha(sourceAccent, 0.07),
                  aspectRatio: isFeature ? '16 / 8.8' : '16 / 9',
                  boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.34 : 0.12)}`,
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
              lineHeight: 1.5
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
              icon={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />} 
              label={sourceLabel} 
              size="small" 
              sx={{ 
                  borderRadius: '8px', 
                  fontWeight: 500,
                  color: sourceAccent,
                  border: '1px solid',
                  borderColor: alpha(sourceAccent, 0.3),
                  bgcolor: alpha(sourceAccent, 0.08),
                  '& .MuiChip-icon': { color: 'inherit' },
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
