import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Fab from '@mui/material/Fab';
import Fade from '@mui/material/Fade';
import Avatar from '@mui/material/Avatar';
import Tooltip from '@mui/material/Tooltip';
import Stack from '@mui/material/Stack';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ReactMarkdown from 'react-markdown';
import { useTheme, alpha } from '@mui/material/styles';
import { Contact, agentChatStream } from '../api';

interface AgentChatPanelProps {
  currentContact: Contact | null;
}

type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
};

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({ currentContact }) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: '你好！我是 MercuryDesk 智能助手。我可以帮你搜索消息、总结对话，或者草拟回复。'
        }
      ]);
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput('');
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userText }
    ];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      // Prepare context message if contact is open
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

      if (currentContact) {
        apiMessages.unshift({
          role: 'system',
          content: `User is currently viewing contact: ${currentContact.display_name} (Handle: ${currentContact.handle}).`
        });
      }

      // Add placeholder for assistant response
      setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

      let fullResponse = '';
      const generator = agentChatStream(apiMessages, currentContact?.id);

      for await (const chunk of generator) {
        fullResponse += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last.role === 'assistant' && last.isStreaming) {
            return [...prev.slice(0, -1), { ...last, content: fullResponse }];
          }
          return prev;
        });
      }

      // Finalize
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, isStreaming: false }];
      });

    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `(Error: ${err instanceof Error ? err.message : 'Unknown error'})` }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Tooltip title="AI 助手" placement="left">
        <Fab
          color="primary"
          aria-label="chat"
          onClick={() => setIsOpen(!isOpen)}
          sx={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            zIndex: 1200,
            boxShadow: '4px 4px 0 0 rgba(0,0,0,1)',
            border: '2px solid',
            borderColor: 'text.primary',
            borderRadius: 0,
            background: theme.palette.background.paper,
            color: theme.palette.text.primary,
            width: 64,
            height: 64,
            transition: 'transform 0.2s',
            overflow: 'hidden',
            '&:hover': {
               transform: 'translate(-2px, -2px)',
               boxShadow: '6px 6px 0 0 rgba(0,0,0,1)',
               background: theme.palette.background.paper,
            }
          }}
        >
          {isOpen ? <CloseIcon /> : (
              <Avatar
                src="/avatar.png"
                sx={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 0,
                    bgcolor: 'transparent',
                    '& img': { objectFit: 'cover' }
                }}
              >
                  <SmartToyIcon sx={{ color: 'text.primary' }} />
              </Avatar>
          )}
        </Fab>
      </Tooltip>

      {/* Chat Window */}
      <Fade in={isOpen} mountOnEnter unmountOnExit>
        <Paper
          elevation={24}
          sx={{
            position: 'fixed',
            bottom: 100,
            right: 32,
            width: 380,
            height: 550,
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1200,
            borderRadius: 0,
            overflow: 'hidden',
            border: '2px solid',
            borderColor: 'text.primary',
            bgcolor: 'background.paper',
            boxShadow: '8px 8px 0 0 rgba(0,0,0,1)',
          }}
        >
          {/* Header */}
          <Box
            p={2}
            bgcolor="background.paper"
            borderBottom="3px solid"
            borderColor="text.primary"
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Box display="flex" alignItems="center" gap={1.5}>
              <Avatar
                src="/avatar.png"
                sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 0,
                    border: '2px solid',
                    borderColor: 'text.primary',
                    bgcolor: 'transparent'
                }}
              >
                AI
              </Avatar>
              <Box>
                <Typography variant="subtitle2" fontWeight="900">Mercury Agent</Typography>
                <Typography variant="caption" color="text.secondary" display="block" lineHeight={1}>
                   {isTyping ? '思考中...' : '在线'}
                </Typography>
              </Box>
            </Box>
            {currentContact && (
                <Box
                    bgcolor="background.paper"
                    px={1}
                    py={0.5}
                    borderRadius={0}
                    border={`2px solid ${theme.palette.divider}`}
                >
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">
                        当前: {currentContact.display_name}
                    </Typography>
                </Box>
            )}
          </Box>

          {/* Messages Area */}
          <Box
            flexGrow={1}
            p={2}
            sx={{
              overflowY: 'auto',
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <Box
                  key={idx}
                  alignSelf={isUser ? 'flex-end' : 'flex-start'}
                  maxWidth="85%"
                >
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      px: 2,
                      borderRadius: 0,
                      border: '2px solid',
                      borderColor: 'text.primary',
                      bgcolor: isUser ? 'text.primary' : 'background.paper',
                      color: isUser ? 'background.paper' : 'text.primary',
                      boxShadow: isUser ? '4px 4px 0 0 rgba(0,0,0,0.2)' : '4px 4px 0 0 rgba(0,0,0,1)',
                    }}
                  >
                    {isUser ? (
                      <Typography variant="body2">{msg.content}</Typography>
                    ) : (
                      <Box
                        sx={{
                          '& p': { m: 0, mb: 1, '&:last-child': { mb: 0 } },
                          '& code': {
                             bgcolor: alpha(theme.palette.text.primary, 0.1),
                             px: 0.5,
                             borderRadius: 0.5,
                             fontFamily: 'monospace'
                          },
                          fontSize: '0.875rem'
                        }}
                      >
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </Box>
                    )}
                  </Paper>
                </Box>
              );
            })}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input Area */}
          <Box p={2} bgcolor="background.paper" borderTop="1px solid" borderColor="divider">
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="输入消息..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
                multiline
                maxRows={3}
                sx={{
                    '& .MuiOutlinedInput-root': {
                        borderRadius: 0,
                        border: '2px solid transparent', // Let theme handle it
                    }
                }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                sx={{
                    border: '2px solid',
                    borderColor: 'text.primary',
                    borderRadius: 0,
                    color: 'text.primary',
                    '&:hover': {
                        bgcolor: 'action.hover',
                        boxShadow: '2px 2px 0 0 rgba(0,0,0,1)'
                    }
                }}
              >
                <SendIcon />
              </IconButton>
            </Stack>
          </Box>
        </Paper>
      </Fade>
    </>
  );
};
