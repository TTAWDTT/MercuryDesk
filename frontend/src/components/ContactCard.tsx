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
import { Contact } from '../api';
import { motion } from 'framer-motion';
import { useTheme, alpha } from '@mui/material/styles';

interface ContactCardProps {
  contact: Contact;
  onClick: (contact: Contact) => void;
  index: number;
}

export const ContactCard: React.FC<ContactCardProps> = ({ contact, onClick, index }) => {
  const theme = useTheme();

  const getSourceIcon = (source?: string | null) => {
    if (!source) return <EmailIcon fontSize="small" />;
    if (source.includes('github')) return <GitHubIcon fontSize="small" />;
    return <EmailIcon fontSize="small" />;
  };

  const formattedDate = contact.last_message_at
    ? formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: true })
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.4 }}
    >
      <Card 
        onClick={() => onClick(contact)}
        sx={{ 
          cursor: 'pointer', 
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            borderColor: theme.palette.primary.light,
            // Subtle "glow" effect
            boxShadow: `0 10px 15px -3px ${alpha(theme.palette.primary.main, 0.1)}, 0 4px 6px -2px ${alpha(theme.palette.primary.main, 0.05)}`
          }
        }}
      >
        {contact.unread_count > 0 && (
            <Box 
                sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    m: 2
                }}
            />
        )}

        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Box display="flex" alignItems="center" mb={2.5}>
            <Avatar 
              src={contact.avatar_url || undefined} 
              sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.1), 
                  color: theme.palette.primary.main,
                  width: 52, 
                  height: 52,
                  fontWeight: 600
              }}
            >
              {!contact.avatar_url && (contact.display_name?.[0] || <PersonIcon />)}
            </Avatar>
            <Box ml={2} overflow="hidden">
              <Typography variant="h6" noWrap title={contact.display_name} sx={{ fontSize: '1.05rem' }}>
                {contact.display_name}
              </Typography>
              <Typography variant="body2" color="textSecondary" noWrap title={contact.handle} sx={{ fontSize: '0.85rem' }}>
                {contact.handle}
              </Typography>
            </Box>
          </Box>

          <Box 
            sx={{ 
                minHeight: 64, 
                p: 1.5, 
                bgcolor: alpha(theme.palette.background.default, 0.5), 
                borderRadius: 2,
                mb: 2
            }}
          >
            <Typography variant="subtitle2" fontWeight="600" noWrap gutterBottom sx={{ fontSize: '0.9rem' }}>
              {contact.latest_subject || 'No messages'}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '0.85rem',
              lineHeight: 1.4
            }}>
              {contact.latest_preview || '...'}
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Chip 
              icon={getSourceIcon(contact.latest_source)} 
              label={contact.latest_source || 'email'} 
              size="small" 
              sx={{ 
                  borderRadius: 1.5, 
                  bgcolor: alpha(theme.palette.secondary.main, 0.05),
                  color: theme.palette.secondary.dark,
                  fontWeight: 500,
                  border: 'none',
                  '& .MuiChip-icon': { color: 'inherit' }
              }} 
            />
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500 }}>
              {formattedDate}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};