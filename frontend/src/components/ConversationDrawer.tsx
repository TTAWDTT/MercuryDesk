import React, { useEffect, useState } from 'react';
import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import { Contact, Message, listMessages, markContactRead } from '../api';
import { format } from 'date-fns';
import { useTheme, alpha } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { motion, AnimatePresence } from 'framer-motion';

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
            borderRadius: { xs: 0, md: 6 },
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
              <Typography variant="body1" color="textSecondary">No messages yet.</Typography>
          </Box>
        ) : (
          <Box display="flex" flexDirection="column" gap={3}>
            <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
              <Paper 
                elevation={0}
                sx={{ 
                    p: 3, 
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    transition: 'box-shadow 0.2s',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
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
                        {format(new Date(msg.received_at), 'MMM d, p')}
                    </Typography>
                </Box>
                
                <Typography variant="h6" gutterBottom fontSize="1.05rem" fontWeight="600">
                  {msg.subject}
                </Typography>
                
                <Typography variant="body2" color="textSecondary" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {msg.body_preview}
                </Typography>

                {msg.summary && (
                  <Box 
                    mt={2.5} 
                    p={2} 
                    bgcolor={alpha(theme.palette.secondary.main, 0.04)} 
                    borderRadius={2}
                    border={`1px solid ${alpha(theme.palette.secondary.main, 0.1)}`}
                    display="flex"
                    gap={1.5}
                  >
                     <AutoAwesomeIcon sx={{ color: theme.palette.secondary.main, fontSize: 20, mt: 0.3 }} />
                     <Box>
                         <Typography variant="caption" fontWeight="bold" color="secondary" gutterBottom display="block">
                             AI Summary
                         </Typography>
                         <Typography variant="body2" fontSize="0.875rem" color="textPrimary">
                             {msg.summary}
                         </Typography>
                     </Box>
                  </Box>
                )}
              </Paper>
              </motion.div>
            ))}
            </AnimatePresence>
          </Box>
        )}
      </Box>
    </Drawer>
  );
};