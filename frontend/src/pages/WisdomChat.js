import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  TextField,
  IconButton,
  CircularProgress,
  Avatar,
  Tooltip,
  Button,
  Divider,
  Container,
  Chip,
} from '@mui/material';
import {
  Send as SendIcon,
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  DeleteOutline as DeleteIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import api from '../services/api';

const SUGGESTED_QUESTIONS = [
  'What was life like when you were young?',
  'Tell me about our family traditions',
  'What advice do you have for me?',
  'What did you learn from your parents?',
  'How did you overcome hard times?',
  'What are you most proud of?',
];

const WisdomChat = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [person, setPerson] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAvailability();
    fetchHistory();
  }, [personId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchAvailability = async () => {
    try {
      const res = await api.get(`/wisdom-chat/person/${personId}/availability`);
      setPerson(res.data.person);
      setAvailability(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/wisdom-chat/person/${personId}/history`);
      setMessages(res.data.messages);
    } catch (err) {
      // Silent fail — history may just be empty
    }
  };

  const handleSend = async (messageText) => {
    const text = (messageText || input).trim();
    if (!text || sending) return;

    setInput('');
    setError('');

    // Optimistically add user message
    const userMsg = { role: 'user', message: text, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await api.post(`/wisdom-chat/person/${personId}/message`, { message: text });
      const aiMsg = {
        chat_id: res.data.chatId,
        role: 'assistant',
        message: res.data.message,
        created_at: res.data.createdAt,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get response. Please try again.');
      // Remove the optimistic user message on error
      setMessages((prev) => prev.filter((m) => m !== userMsg));
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all messages in this conversation?')) return;
    try {
      await api.delete(`/wisdom-chat/person/${personId}/history`);
      setMessages([]);
    } catch (err) {
      setError('Failed to clear history');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!availability?.available) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <AutoAwesomeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h5" gutterBottom>
          No Stories Yet
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {person?.full_name} has no recorded oral history stories yet.
          Add stories to unlock Wisdom Chat — you'll be able to converse with {person?.full_name}'s wisdom as if they were here.
        </Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/person/${personId}`)}
        >
          Back to {person?.full_name}
        </Button>
      </Container>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxWidth: '800px',
        mx: 'auto',
        bgcolor: 'background.default',
      }}
    >
      {/* Header */}
      <Paper
        elevation={1}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          p: 2,
          borderRadius: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <IconButton onClick={() => navigate(`/person/${personId}`)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Avatar
          src={person?.profile_photo_url}
          sx={{
            bgcolor: 'primary.main',
            width: 44,
            height: 44,
          }}
        >
          {person?.full_name?.charAt(0) || '?'}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, truncate: 1 }}>
            Wisdom Chat with {person?.full_name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AutoAwesomeIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary">
              Powered by Gemini AI · {availability.storyCount} stories
            </Typography>
          </Box>
        </Box>
        <Tooltip title="Clear conversation">
          <IconButton onClick={handleClearHistory} size="small" disabled={messages.length === 0}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* Messages */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', mt: 6, mx: 'auto', maxWidth: 500 }}>
            <AutoAwesomeIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Speak with {person?.full_name}'s wisdom
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Ask anything about life, family, traditions, or advice. Responses are drawn from {person?.full_name}'s recorded stories and life experiences.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {SUGGESTED_QUESTIONS.map((q) => (
                <Chip
                  key={q}
                  icon={<LightbulbIcon sx={{ fontSize: 16 }} />}
                  label={q}
                  onClick={() => handleSend(q)}
                  variant="outlined"
                  clickable
                  sx={{ maxWidth: '100%' }}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map((msg, idx) => (
          <Box
            key={msg.chat_id || idx}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1,
                maxWidth: '80%',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              }}
            >
              {msg.role === 'assistant' && (
                <Avatar
                  src={person?.profile_photo_url}
                  sx={{ width: 32, height: 32, bgcolor: 'primary.main', flexShrink: 0 }}
                >
                  {person?.full_name?.charAt(0) || '?'}
                </Avatar>
              )}
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                  color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  border: msg.role === 'user' ? 'none' : '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.6,
                    fontSize: '0.9rem',
                  }}
                >
                  {msg.message}
                </Typography>
              </Paper>
            </Box>
          </Box>
        ))}

        {sending && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
            <Avatar
              src={person?.profile_photo_url}
              sx={{ width: 32, height: 32, bgcolor: 'primary.main', flexShrink: 0 }}
            >
              {person?.full_name?.charAt(0) || '?'}
            </Avatar>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {person?.full_name} is reflecting...
              </Typography>
            </Paper>
          </Box>
        )}

        {error && (
          <Box sx={{ mx: 'auto', maxWidth: 500 }}>
            <Paper
              elevation={0}
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                bgcolor: 'error.light',
                color: 'error.contrastText',
              }}
            >
              <Typography variant="body2">{error}</Typography>
            </Paper>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Paper
        elevation={2}
        sx={{
          p: 2,
          borderRadius: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${person?.full_name} a question...`}
            variant="outlined"
            size="small"
            disabled={sending}
          />
          <IconButton
            color="primary"
            onClick={() => handleSend()}
            disabled={!input.trim() || sending}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              '&:disabled': { bgcolor: 'action.disabledBackground' },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
          AI responses are generated from recorded stories. Not all answers may reflect the person's actual views.
        </Typography>
      </Paper>
    </Box>
  );
};

export default WisdomChat;
