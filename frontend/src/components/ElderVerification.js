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
import { db } from '../firebase';
import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const ElderVerification = ({ person, open, onClose, onVerify, currentUser }) => {
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [editHistory, setEditHistory] = useState([]);

  const handleVerify = async () => {
    if (!person || !currentUser) return;
    
    setVerifying(true);
    try {
      const personRef = doc(db, 'persons', person.person_id);
      await updateDoc(personRef, {
        verified_by: currentUser.uid,
        verified_at: serverTimestamp(),
        verification_status: 'verified',
        verification_notes: verificationNotes || null,
      });

      // Create verification record
      await addDoc(collection(db, 'verifications'), {
        person_id: person.person_id,
        family_id: person.family_id,
        verified_by: currentUser.uid,
        verified_at: serverTimestamp(),
        status: 'verified',
        notes: verificationNotes || null,
      });

      if (onVerify) {
        onVerify({ ...person, verified_by: currentUser.uid, verification_status: 'verified' });
      }
      onClose();
      setVerificationNotes('');
    } catch (error) {
      console.error('Failed to verify person:', error);
      // Error will be handled by parent component via Snackbar
      throw error; // Re-throw so parent can handle
    } finally {
      setVerifying(false);
    }
  };

  const handleReject = async () => {
    if (!person || !currentUser) return;
    
    setVerifying(true);
    try {
      const personRef = doc(db, 'persons', person.person_id);
      await updateDoc(personRef, {
        verification_status: 'rejected',
        verification_notes: verificationNotes || null,
      });

      await addDoc(collection(db, 'verifications'), {
        person_id: person.person_id,
        family_id: person.family_id,
        verified_by: currentUser.uid,
        verified_at: serverTimestamp(),
        status: 'rejected',
        notes: verificationNotes || null,
      });

      if (onVerify) {
        onVerify({ ...person, verification_status: 'rejected' });
      }
      onClose();
      setVerificationNotes('');
    } catch (error) {
      console.error('Failed to reject verification:', error);
      // Error will be handled by parent component via Snackbar
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

