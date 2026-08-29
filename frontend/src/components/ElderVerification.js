import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  VerifiedUser as VerifiedUserIcon,
} from '@mui/icons-material';
import api from '../services/api';

const ElderVerification = ({ person, open, onClose, onVerify, currentUser }) => {
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [editHistory, setEditHistory] = useState([]);

  const handleVerify = async () => {
    if (!person || !currentUser) return;
    
    setVerifying(true);
    try {
      await api.put(`/persons/${person.person_id}`, {
        verified_by_elder: true,
        verified_by_user_id: currentUser.user_id,
      });

      if (onVerify) {
        onVerify({ ...person, verified_by_elder: true, verified_by_user_id: currentUser.user_id });
      }
      onClose();
      setVerificationNotes('');
    } catch (error) {
      console.error('Failed to verify person:', error);
      throw error;
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!person || !currentUser) return;
    
    setVerifying(true);
    try {
      await api.put(`/persons/${person.person_id}`, {
        verified_by_elder: false,
      });

      if (onVerify) {
        onVerify({ ...person, verified_by_elder: false });
      }
      onClose();
      setVerificationNotes('');
    } catch (error) {
      console.error('Failed to reject verification:', error);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VerifiedUserIcon color="primary" />
          <Typography variant="h6">Verify Person Information</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Verifying: <strong>{person?.full_name}</strong>
          </Typography>
          {person?.verification_status === 'verified' && (
            <Alert severity="success" sx={{ mt: 2 }}>
              This person has been verified by an elder.
            </Alert>
          )}
          {person?.verification_status === 'rejected' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              This person's information was rejected and needs review.
            </Alert>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Verification Notes (Optional)
        </Typography>
        <TextField
          fullWidth
          multiline
          rows={4}
          value={verificationNotes}
          onChange={(e) => setVerificationNotes(e.target.value)}
          placeholder="Add any notes about this verification..."
          sx={{ mt: 1, mb: 2 }}
        />

        {editHistory.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              Recent Changes
            </Typography>
            <List dense>
              {editHistory.map((edit, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={edit.field}
                    secondary={`Changed by ${edit.user} on ${new Date(edit.timestamp).toLocaleDateString()}`}
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={verifying}>
          Cancel
        </Button>
        <Button
          onClick={handleReject}
          color="error"
          variant="outlined"
          startIcon={<CancelIcon />}
          disabled={verifying}
        >
          Reject
        </Button>
        <Button
          onClick={handleVerify}
          color="primary"
          variant="contained"
          startIcon={<CheckCircleIcon />}
          disabled={verifying}
        >
          {verifying ? 'Verifying...' : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ElderVerification;

