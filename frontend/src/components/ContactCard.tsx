import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Badge from '@mui/material/Badge';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Contact } from '../api';
import { motion } from 'framer-motion';
import { useTheme, alpha } from '@mui/material/styles';

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

  const getSourceIcon = (source?: string | null) => {
    if (!source) return <EmailIcon fontSize="small" />;
    if (source.includes('github')) return <GitHubIcon fontSize="small" />;
    return <EmailIcon fontSize="small" />;
  };

  const formattedDate = contact.last_message_at
    ? formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: true, locale: zhCN })
    : '';

  const sourceLabel = (() => {
    const src = (contact.latest_source || 'email').toLowerCase();
    if (src.includes('github')) return 'GitHub';
    if (src.includes('mock')) return '演示';
    return '邮件';
  })();

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
          borderColor: 'divider',
          '&:hover': {
            ...(disabled
              ? {}
              : {
                  transform: isFeature ? 'translateY(-3px)' : 'translateY(-4px)',
                  borderColor: 'primary.main',
                  boxShadow: theme.shadows[4],
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
            p: isFeature ? { xs: 3.5, md: 4 } : { xs: 3, md: 3.5 },
            '&:last-child': { pb: isFeature ? { xs: 3.5, md: 4 } : { xs: 3, md: 3.5 } }
          }}
        >
          <Box display="flex" alignItems="center" mb={2}>
            <Avatar 
              src={contact.avatar_url || undefined} 
              sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.1), 
                  color: theme.palette.primary.main,
                  width: isFeature ? 72 : 60, 
                  height: isFeature ? 72 : 60,
                  fontWeight: 600,
                  borderRadius: isFeature ? '16px' : '14px'
              }}
            >
              {!contact.avatar_url && (contact.display_name?.[0] || <PersonIcon />)}
            </Avatar>
            <Box ml={2} overflow="hidden">
              <Typography
                variant={isFeature ? 'h5' : 'h6'}
                noWrap
                sx={{
                  fontSize: isFeature ? { xs: '1.25rem', md: '1.4rem' } : { xs: '1.1rem', md: '1.18rem' },
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
                p: isFeature ? { xs: 2.25, md: 2.75 } : 2, 
                bgcolor: alpha(theme.palette.action.hover, 0.5), 
                borderRadius: '14px',
                mb: isFeature ? 2.5 : 2,
            }}
          >
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
              {contact.latest_subject || '暂无消息'}
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
              {contact.latest_preview || '...'}
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" gap={2}>
            <Chip 
              icon={getSourceIcon(contact.latest_source)} 
              label={sourceLabel} 
              size="small" 
              sx={{ 
                  borderRadius: '8px', 
                  fontWeight: 500,
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
