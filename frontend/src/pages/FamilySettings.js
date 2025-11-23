import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  Chip,
  AppBar,
  Toolbar,
  IconButton,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';

const FamilySettings = () => {
  const { familyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [family, setFamily] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    fetchFamilyDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const fetchFamilyDetails = async () => {
    try {
      const familyRef = doc(db, 'families', familyId);
      const snap = await getDoc(familyRef);
      if (!snap.exists()) {
        setFamily(null);
        return;
      }
      setFamily({ family_id: snap.id, ...snap.data() });
      // Members & usage tracking not yet implemented in client-only mode
      setMembers([]);
    } catch (error) {
      console.error('Failed to fetch family details:', error);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setSnackbar({ 
        open: true, 
        message: 'Please enter a valid email address', 
        severity: 'warning' 
      });
      return;
    }

    try {
      // Generate invitation token
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      // Store invitation in Firestore
      // The email will be sent automatically by Firebase Function trigger
      const invitationsRef = collection(db, 'familyInvitations');
      await addDoc(invitationsRef, {
        family_id: familyId,
        email: inviteEmail.trim().toLowerCase(),
        invited_by_user_id: user?.user_id || user?.uid || null,
        token: token,
        role: 'member',
        status: 'pending',
        expires_at: expiresAt,
        created_at: serverTimestamp(),
      });

      setSnackbar({ 
        open: true, 
        message: `Invitation sent to ${inviteEmail}. The email will be sent automatically.`, 
        severity: 'success' 
      });
      setInviteEmail('');
    } catch (error) {
      console.error('Failed to create invitation:', error);
      setSnackbar({ 
        open: true, 
        message: 'Failed to create invitation. Please try again.', 
        severity: 'error' 
      });
    }
  };

  if (!family) {
    return <Typography>Loading...</Typography>;
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate(-1)}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Family Settings
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h5" gutterBottom>
            {family.family_name}
          </Typography>
          {family.clan_name && (
            <Typography variant="body1" color="text.secondary">
              Clan: {family.clan_name}
            </Typography>
          )}
          {family.village_origin && (
            <Typography variant="body1" color="text.secondary">
              Origin: {family.village_origin}
            </Typography>
          )}
          <Box sx={{ mt: 2 }}>
            <Chip 
              label={`${family.subscription_tier?.toUpperCase() || 'FREE'} Tier`} 
              color={family.subscription_tier === 'free' ? 'default' : 'primary'}
              sx={{ mr: 1 }}
            />
            {family.usage && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Usage:</Typography>
                <Typography variant="body2">
                  Persons: {family.usage.usage.persons} / {family.usage.limits.max_persons === -1 ? '∞' : family.usage.limits.max_persons}
                </Typography>
                <Typography variant="body2">
                  Documents: {family.usage.usage.documents} / {family.usage.limits.max_documents === -1 ? '∞' : family.usage.limits.max_documents}
                </Typography>
                <Typography variant="body2">
                  Storage: {family.usage.usage.storage_mb} MB / {family.usage.limits.max_storage_mb === -1 ? '∞' : family.usage.limits.max_storage_mb} MB
                </Typography>
                <Typography variant="body2">
                  Members: {family.usage.usage.members} / {family.usage.limits.max_members === -1 ? '∞' : family.usage.limits.max_members}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Invite Family Members
          </Typography>
          <Box display="flex" gap={2} sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Enter email address"
            />
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={handleInvite}
            >
              Invite
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Family Members
          </Typography>
          <List>
            {members.map((member) => (
              <ListItem key={member.user_id}>
                <ListItemText
                  primary={member.full_name}
                  secondary={member.email}
                />
                <Chip label={member.role} size="small" />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default FamilySettings;

