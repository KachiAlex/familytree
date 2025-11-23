import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Card,
  CardContent,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Error as ErrorIcon } from '@mui/icons-material';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';

const ClaimPerson = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      fetchInvitation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, authLoading]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        setError('Invalid invitation link. No token provided.');
        setLoading(false);
        return;
      }

      // Fetch invitation by token
      const invitationsRef = collection(db, 'personInvitations');
      const q = query(invitationsRef, where('token', '==', token));
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (queryError) {
        console.error('Firestore query error:', queryError);
        // Check if it's an index error
        if (queryError.code === 'failed-precondition') {
          setError('Database index required. Please contact support or try again later.');
        } else {
          setError('Failed to load invitation. Please check your internet connection and try again.');
        }
        setLoading(false);
        return;
      }

      if (snapshot.empty) {
        setError('Invalid or expired invitation link. Please check the link or request a new invitation.');
        setLoading(false);
        return;
      }

      const invitationData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      
      // Validate invitation data
      if (!invitationData.person_id || !invitationData.family_id) {
        setError('Invalid invitation data. Please request a new invitation.');
        setLoading(false);
        return;
      }
      
      setInvitation(invitationData);

      // Check if invitation is expired
      if (invitationData.expires_at) {
        const expiresAt = invitationData.expires_at.toDate();
        if (expiresAt < new Date()) {
          setError('This invitation has expired. Please request a new invitation.');
          setLoading(false);
          return;
        }
      }

      // Check if already claimed
      if (invitationData.status === 'accepted') {
        setError('This invitation has already been claimed.');
        setLoading(false);
        return;
      }

      // Fetch person details
      let personSnap;
      try {
        const personRef = doc(db, 'persons', invitationData.person_id);
        personSnap = await getDoc(personRef);
      } catch (personError) {
        console.error('Error fetching person:', personError);
        setError('Failed to load person information. Please try again.');
        setLoading(false);
        return;
      }
      
      if (!personSnap.exists()) {
        setError('Person profile not found. The profile may have been deleted.');
        setLoading(false);
        return;
      }

      const personData = { person_id: personSnap.id, ...personSnap.data() };
      setPerson(personData);

      // Check if person already has an owner
      if (personData.ownerUserId) {
        setError('This person profile has already been claimed by another user.');
        setLoading(false);
        return;
      }

      // Check if user is logged in and email matches
      if (isAuthenticated && user) {
        if (user.email?.toLowerCase() !== invitationData.email.toLowerCase()) {
          setError(`This invitation was sent to ${invitationData.email}. Please log in with that email address.`);
        }
      }
    } catch (err) {
      console.error('Failed to fetch invitation:', err);
      setError('Failed to load invitation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!user || !invitation || !person) return;

    // Verify email matches
    if (user.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setError(`This invitation was sent to ${invitation.email}. Please log in with that email address.`);
      return;
    }

    setClaiming(true);
    setError('');

    try {
      // Update invitation status
      const invitationRef = doc(db, 'personInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
        claimed_at: serverTimestamp(),
        claimed_by_user_id: user.user_id || user.uid || user.email,
      });

      // Update person with owner
      const personRef = doc(db, 'persons', person.person_id);
      await updateDoc(personRef, {
        ownerUserId: user.user_id || user.uid || user.email,
        claimed_at: serverTimestamp(),
      });

      setSuccess(true);
      
      // Redirect to person detail page after 2 seconds
      setTimeout(() => {
        navigate(`/person/${person.person_id}`);
      }, 2000);
    } catch (err) {
      console.error('Failed to claim person:', err);
      if (err.code === 'permission-denied') {
        setError('Permission denied. Please ensure you are logged in with the correct email address.');
      } else {
        setError('Failed to claim profile. Please try again.');
      }
      setClaiming(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error && !invitation) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ErrorIcon color="error" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Invalid Invitation
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            {error}
          </Typography>
          <Button variant="contained" onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </Paper>
      </Container>
    );
  }

  if (success) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon color="success" sx={{ fontSize: 64, mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Profile Claimed Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            You have successfully claimed the profile for <strong>{person?.full_name}</strong>.
            Redirecting to the profile page...
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Claim Your Profile
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {invitation && person && (
          <>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Invitation Details
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Person Name
                    </Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {person.full_name}
                    </Typography>
                  </Grid>
                  {person.date_of_birth && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Date of Birth
                      </Typography>
                      <Typography variant="body1">
                        {new Date(person.date_of_birth).toLocaleDateString()}
                      </Typography>
                    </Grid>
                  )}
                  {person.place_of_birth && (
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">
                        Place of Birth
                      </Typography>
                      <Typography variant="body1">
                        {person.place_of_birth}
                      </Typography>
                    </Grid>
                  )}
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Invitation sent to
                    </Typography>
                    <Typography variant="body1">
                      {invitation.email}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {!isAuthenticated ? (
              <Box>
                <Alert severity="info" sx={{ mb: 3 }}>
                  You need to log in to claim this profile. Please log in with the email address: <strong>{invitation.email}</strong>
                </Alert>
                <Box display="flex" gap={2}>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/login')}
                    fullWidth
                  >
                    Log In
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => navigate('/register')}
                    fullWidth
                  >
                    Create Account
                  </Button>
                </Box>
              </Box>
            ) : user.email?.toLowerCase() !== invitation.email.toLowerCase() ? (
              <Box>
                <Alert severity="warning" sx={{ mb: 3 }}>
                  This invitation was sent to <strong>{invitation.email}</strong>, but you are logged in as <strong>{user.email}</strong>.
                  Please log out and log in with the correct email address.
                </Alert>
                <Button
                  variant="contained"
                  onClick={() => {
                    // Logout and redirect to login with return path
                    sessionStorage.setItem('returnAfterLogin', `/claim/${token}`);
                    window.location.href = '/login';
                  }}
                  fullWidth
                >
                  Log Out and Use Correct Email
                </Button>
              </Box>
            ) : (
              <Box>
                <Alert severity="success" sx={{ mb: 3 }}>
                  You are logged in as <strong>{user.email}</strong>. Click the button below to claim this profile.
                </Alert>
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  onClick={handleClaim}
                  disabled={claiming}
                  sx={{ py: 1.5 }}
                >
                  {claiming ? 'Claiming...' : 'Claim This Profile'}
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
};

export default ClaimPerson;

