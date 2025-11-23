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
  TextField,
} from '@mui/material';
import { CheckCircle as CheckCircleIcon, Error as ErrorIcon } from '@mui/icons-material';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

const ClaimPerson = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading, login } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);

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

  const handleLoginWithPassword = async (e) => {
    e.preventDefault();
    setError('');
    setAuthenticating(true);

    try {
      const result = await login(invitation.email, password);
      
      if (result.success) {
        // User is now logged in
        // Wait a moment for auth state to update, then claim
        setTimeout(() => {
          handleClaim();
        }, 500);
      } else {
        // Check if user doesn't exist - show signup option
        if (result.error?.includes('user-not-found') || result.error?.includes('auth/user-not-found')) {
          setError('No account found with this email. Please create an account below.');
          setIsNewUser(true);
        } else if (result.error?.includes('wrong-password') || result.error?.includes('invalid-credential')) {
          setError('Invalid password. Please try again.');
        } else {
          setError(result.error || 'Invalid password. Please try again.');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please create an account below.');
        setIsNewUser(true);
      } else {
        setError(err.message || 'Failed to log in. Please try again.');
      }
    } finally {
      setAuthenticating(false);
    }
  };

  const handleSignupAndClaim = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setAuthenticating(true);

    try {
      // Use person's name as default, or the entered full name
      const nameToUse = fullName || person?.full_name || '';
      
      // Step 1: Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, invitation.email, password);
      const firebaseUser = credential.user;

      // Step 2: Update display name
      if (nameToUse) {
        await updateProfile(firebaseUser, { displayName: nameToUse });
      }

      // Step 3: Create user profile in Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, {
        email: invitation.email,
        full_name: nameToUse,
        phone: null,
        role: 'member',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // Step 4: Join the existing family FIRST (before claiming)
      // This is critical - user must be a family member to claim the profile
      const existingFamilyId = invitation.family_id;
      const membershipRef = doc(db, 'familyMembers', `${existingFamilyId}_${firebaseUser.uid}`);
      await setDoc(membershipRef, {
        family_id: existingFamilyId,
        user_id: firebaseUser.uid,
        role: 'member',
        invited_by: invitation.invited_by_user_id || null,
        status: 'active',
        joined_at: serverTimestamp(),
        created_at: serverTimestamp(),
      });

      // Step 5: Wait a moment for Firestore to propagate the membership
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 6: Now claim the profile (user is now a family member)
      const invitationRef = doc(db, 'personInvitations', invitation.id);
      await updateDoc(invitationRef, {
        status: 'accepted',
        claimed_at: serverTimestamp(),
        claimed_by_user_id: firebaseUser.uid,
      });

      const personRef = doc(db, 'persons', person.person_id);
      await updateDoc(personRef, {
        ownerUserId: firebaseUser.uid,
        claimed_at: serverTimestamp(),
      });

      // Success - redirect to profile
      setSuccess(true);
      setTimeout(() => {
        navigate(`/person/${person.person_id}`);
      }, 2000);

      setAuthenticating(false);
    } catch (err) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please log in instead.');
        setIsNewUser(false);
      } else {
        setError(err.message || 'Failed to create account. Please try again.');
      }
      setAuthenticating(false);
    }
  };

  // Auto-claim when user becomes authenticated with matching email
  useEffect(() => {
    if (isAuthenticated && user && invitation && person && !claiming && !success) {
      if (user.email?.toLowerCase() === invitation.email.toLowerCase()) {
        handleClaim();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user, invitation, person]);

  const handleClaim = async () => {
    if (!user || !invitation || !person) {
      return;
    }

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
                  To claim this profile, please enter your password. Your email <strong>{invitation.email}</strong> is already set.
                </Alert>
                
                {!isNewUser ? (
                  // Login form (password only)
                  <Box component="form" onSubmit={handleLoginWithPassword}>
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={invitation.email}
                      disabled
                      margin="normal"
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      margin="normal"
                      autoFocus
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      size="large"
                      disabled={authenticating || !password}
                      sx={{ mt: 3, mb: 2, py: 1.5 }}
                    >
                      {authenticating ? 'Logging in...' : 'Log In & Claim Profile'}
                    </Button>
                    <Button
                      variant="text"
                      fullWidth
                      onClick={() => setIsNewUser(true)}
                      sx={{ mt: 1 }}
                    >
                      Don't have an account? Create one
                    </Button>
                  </Box>
                ) : (
                  // Signup form (email pre-filled, just need name and password)
                  <Box component="form" onSubmit={handleSignupAndClaim}>
                    <TextField
                      fullWidth
                      label="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      margin="normal"
                      autoFocus
                      helperText="Your name as it appears in the family tree"
                    />
                    <TextField
                      fullWidth
                      label="Email"
                      type="email"
                      value={invitation.email}
                      disabled
                      margin="normal"
                      sx={{ mb: 2 }}
                    />
                    <TextField
                      fullWidth
                      label="Password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      margin="normal"
                      helperText="Must be at least 6 characters"
                    />
                    <Button
                      type="submit"
                      variant="contained"
                      fullWidth
                      size="large"
                      disabled={authenticating || !password || !fullName || password.length < 6}
                      sx={{ mt: 3, mb: 2, py: 1.5 }}
                    >
                      {authenticating ? 'Creating account...' : 'Create Account & Claim Profile'}
                    </Button>
                    <Button
                      variant="text"
                      fullWidth
                      onClick={() => setIsNewUser(false)}
                      sx={{ mt: 1 }}
                    >
                      Already have an account? Log in
                    </Button>
                  </Box>
                )}
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

