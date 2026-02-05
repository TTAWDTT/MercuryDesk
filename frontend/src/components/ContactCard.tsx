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
      style={{ height: '100%' }}
    >
      <Card 
        onClick={() => onClick(contact)}
        sx={{ 
          cursor: 'pointer', 
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 6, // Increased border radius (approx 24px-32px depending on theme scaling)
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: theme.palette.primary.light,
            boxShadow: `0 12px 24px -4px ${alpha(theme.palette.primary.main, 0.15)}, 0 8px 16px -4px ${alpha(theme.palette.primary.main, 0.1)}`
          }
        }}
      >
        {contact.unread_count > 0 && (
            <Box 
                sx={{
                    position: 'absolute',
                    top: 20,
                    right: 20,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    boxShadow: '0 0 0 4px ' + theme.palette.background.paper,
                    zIndex: 1
                }}
            />
        )}

        <CardContent sx={{ p: 4, '&:last-child': { pb: 4 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box display="flex" alignItems="center" mb={3}>
            <Avatar 
              src={contact.avatar_url || undefined} 
              sx={{ 
                  bgcolor: alpha(theme.palette.primary.main, 0.1), 
                  color: theme.palette.primary.main,
                  width: 64, 
                  height: 64,
                  fontWeight: 600,
                  fontSize: '1.5rem',
                  borderRadius: 3
              }}
            >
              {!contact.avatar_url && (contact.display_name?.[0] || <PersonIcon />)}
            </Avatar>
            <Box ml={2.5} overflow="hidden">
              <Typography variant="h6" noWrap title={contact.display_name} sx={{ fontSize: '1.15rem', fontWeight: 700 }}>
                {contact.display_name}
              </Typography>
              <Typography variant="body2" color="textSecondary" noWrap title={contact.handle} sx={{ fontSize: '0.9rem' }}>
                {contact.handle}
              </Typography>
            </Box>
          </Box>

          <Box 
            sx={{ 
                flexGrow: 1,
                p: 2, 
                bgcolor: alpha(theme.palette.background.default, 0.6), 
                borderRadius: 4,
                mb: 3,
                border: '1px solid',
                borderColor: 'divider'
            }}
          >
            <Typography variant="subtitle1" fontWeight="600" noWrap gutterBottom sx={{ fontSize: '1rem' }}>
              {contact.latest_subject || 'No messages'}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontSize: '0.9rem',
              lineHeight: 1.6
            }}>
              {contact.latest_preview || '...'}
            </Typography>
          </Box>

          <Box display="flex" justifyContent="space-between" alignItems="center" mt="auto">
            <Chip 
              icon={getSourceIcon(contact.latest_source)} 
              label={contact.latest_source || 'email'} 
              size="medium" 
              sx={{ 
                  height: 32,
                  borderRadius: 99, 
                  bgcolor: alpha(theme.palette.secondary.main, 0.08),
                  color: theme.palette.secondary.dark,
                  fontWeight: 600,
                  border: 'none',
                  '& .MuiChip-icon': { color: 'inherit' }
              }} 
            />
            <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 500, fontSize: '0.8rem' }}>
              {formattedDate}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};