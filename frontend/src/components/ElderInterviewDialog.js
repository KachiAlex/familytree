import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  TextField,
  IconButton,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  Mic as MicIcon,
  Stop as StopIcon,
  Delete as DeleteIcon,
  RecordVoiceOver as RecordVoiceOverIcon,
} from '@mui/icons-material';
import api from '../services/api';

// Curated prompts for elder oral-history interviews
const QUESTIONS = [
  'Tell me about the village or town where you grew up.',
  'What was your childhood home like? Who lived there?',
  'Who were the most important people in your life when you were young?',
  'How did you meet your husband or wife?',
  'What work did you do, and how did you learn it?',
  'Tell me about a hardship our family overcame.',
  'What traditions, ceremonies, or festivals do you remember?',
  'Is there a story about our family\'s origins that must never be forgotten?',
  'What was school like for you?',
  'Which family meal or recipe means the most to you?',
  'What advice would you give your grandchildren?',
  'Is there anything else you want future generations to know?',
];

const ElderInterviewDialog = ({ person, open, onClose, narratorName, onSaved }) => {
  const [step, setStep] = useState(0);
  const [answer, setAnswer] = useState('');
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      stopTimer();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError('Microphone access denied. You can still type the answer instead.');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    setRecording(false);
  };

  const clearAudio = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setSeconds(0);
  };

  const resetStepState = () => {
    setAnswer('');
    clearAudio();
    setError('');
  };

  const handleSave = async () => {
    if (!answer.trim() && !audioBlob) return;
    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('person_id', person.person_id);
      formData.append('family_id', person.family_id);
      formData.append('title', `Interview: ${QUESTIONS[step]}`);
      if (answer.trim()) formData.append('story_text', answer.trim());
      formData.append('narrator_name', narratorName || person.full_name);
      formData.append('recorded_date', new Date().toISOString().slice(0, 10));
      formData.append('tags', JSON.stringify(['interview']));
      if (audioBlob) {
        formData.append('audio', new File([audioBlob], `answer-${step + 1}.webm`, { type: audioBlob.type }));
      }

      const res = await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSavedCount((c) => c + 1);
      if (onSaved) onSaved(res.data);
      resetStepState();
      if (step < QUESTIONS.length - 1) setStep(step + 1);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save the answer. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    resetStepState();
    if (step < QUESTIONS.length - 1) setStep(step + 1);
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RecordVoiceOverIcon color="primary" />
          <Typography variant="h6">Elder Interview — {person?.full_name}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Question {step + 1} of {QUESTIONS.length}
            </Typography>
            {savedCount > 0 && (
              <Chip size="small" color="success" variant="outlined" label={`${savedCount} saved`} />
            )}
          </Box>
          <LinearProgress variant="determinate" value={((step + 1) / QUESTIONS.length) * 100} />
        </Box>

        <Typography variant="subtitle1" fontWeight="medium" sx={{ mb: 2 }}>
          {QUESTIONS[step]}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          {!recording ? (
            <Button
              variant="outlined"
              color="error"
              startIcon={<MicIcon />}
              onClick={startRecording}
              disabled={saving}
            >
              Record Answer
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              onClick={stopRecording}
            >
              Stop ({fmt(seconds)})
            </Button>
          )}
          {audioUrl && !recording && (
            <>
              <audio controls src={audioUrl} style={{ height: 36, flex: 1 }} />
              <IconButton onClick={clearAudio} size="small" disabled={saving}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          )}
        </Box>
        {audioBlob && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Audio will be auto-transcribed on save.
          </Typography>
        )}

        <TextField
          fullWidth
          multiline
          rows={4}
          label="Or type the answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={saving}
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button onClick={onClose} disabled={saving}>Done</Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {step < QUESTIONS.length - 1 && (
            <Button onClick={handleSkip} disabled={saving}>Skip</Button>
          )}
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || (!answer.trim() && !audioBlob)}
          >
            {saving ? 'Saving…' : 'Save & Next'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default ElderInterviewDialog;
