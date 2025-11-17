import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  FamilyRestroom as FamilyIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggleButton from '../components/ThemeToggleButton';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';

const Dashboard = () => {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const fetchFamilies = useCallback(async (showRetry = false) => {
    try {
      // Wait for auth to finish loading
      if (authLoading) {
        return;
      }

      if (!user) {
        console.warn('No user available for fetching families');
        setFamilies([]);
        setLoading(false);
        return;
      }

      if (showRetry) {
        setRetrying(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const userId = user.user_id || user.userId || user.uid;
      if (!userId) {
        console.error('Unable to determine user ID:', user);
        setError('Unable to determine user. Please try logging out and back in.');
        setFamilies([]);
        setLoading(false);
        setRetrying(false);
        return;
      }

      console.log('Fetching families for user:', userId);

      const membershipRef = collection(db, 'familyMembers');
      const membershipsQuery = query(membershipRef, where('user_id', '==', userId));
      const membershipSnap = await getDocs(membershipsQuery);

      console.log('Found memberships:', membershipSnap.size);

      if (membershipSnap.empty) {
        console.log('No memberships found for user');
        setFamilies([]);
        setLoading(false);
        setRetrying(false);
        return;
      }

      const membershipMap = new Map();
      membershipSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.family_id) {
          membershipMap.set(data.family_id, data.role || 'member');
        }
      });

      if (membershipMap.size === 0) {
        console.log('No valid family IDs found in memberships');
        setFamilies([]);
        setLoading(false);
        setRetrying(false);
        return;
      }

      console.log('Fetching family documents for IDs:', Array.from(membershipMap.keys()));

      const familyDocs = await Promise.all(
        Array.from(membershipMap.keys()).map((familyId) => getDoc(doc(db, 'families', familyId)))
      );

      const list = familyDocs
        .filter((snap) => snap.exists())
        .map((snap) => ({
          family_id: snap.id,
          ...snap.data(),
          user_role: membershipMap.get(snap.id) || 'member',
        }));

      console.log('Successfully loaded families:', list.length);
      setFamilies(list);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch families:', error);
      setError(`Failed to load families: ${error.message || 'Unknown error'}. Please try again.`);
      // Don't clear families on error - keep existing data
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    // Only fetch when auth is done loading and user is available
    if (!authLoading) {
      if (user) {
        fetchFamilies();
      } else {
        setLoading(false);
        setFamilies([]);
      }
    }
  }, [user, authLoading, fetchFamilies]);

  // Refresh data when page becomes visible again (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !authLoading) {
        // Page became visible, refresh data
        fetchFamilies(true);
      }
    };

    const handleFocus = () => {
      if (user && !authLoading) {
        // Window regained focus, refresh data
        fetchFamilies(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, authLoading, fetchFamilies]);

  const handleCreateFamily = async () => {
    // Note: Users can create additional families, but first family is created during registration
    const familyName = prompt('Enter family name:');
    if (!familyName) return;

    const clanName = prompt('Enter clan name (optional):');
    const villageOrigin = prompt('Enter village/town of origin (optional):');

    try {
      const userId = user?.user_id || user?.userId || user?.uid;
      if (!userId) {
        alert('Unable to determine user. Please re-login.');
        return;
      }

      const familiesRef = collection(db, 'families');
      const docRef = await addDoc(familiesRef, {
        family_name: familyName,
        family_name_lower: familyName.toLowerCase(),
        clan_name: clanName || null,
        village_origin: villageOrigin || null,
        subscription_tier: 'free',
        subscription_status: 'active',
        max_persons: 50,
        max_documents: 100,
        max_storage_mb: 500,
        max_members: 10,
        created_by_user_id: userId,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      const membershipRef = doc(db, 'familyMembers', `${docRef.id}_${userId}`);
      await setDoc(membershipRef, {
        family_id: docRef.id,
        user_id: userId,
        role: 'admin',
        invited_by: userId,
        status: 'active',
        joined_at: serverTimestamp(),
        created_at: serverTimestamp(),
      });

      await fetchFamilies();
      navigate(`/family/${docRef.id}/tree`);
    } catch (error) {
      console.error('Failed to create family:', error);
      setError(`Failed to create family: ${error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <FamilyIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            African Family Tree
          </Typography>
          <ThemeToggleButton />
          <IconButton color="inherit" onClick={handleMenuOpen}>
            <AccountCircleIcon />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>{user?.full_name}</MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            My Families
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              startIcon={retrying ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={() => fetchFamilies(true)}
              disabled={retrying || loading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateFamily}
            >
              Create Family Tree
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            onClose={() => setError(null)}
            action={
              <Button color="inherit" size="small" onClick={() => fetchFamilies(true)}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {loading ? (
          <Grid container spacing={3}>
            {[1, 2, 3].map((item) => (
              <Grid item xs={12} md={6} lg={4} key={item}>
                <Card>
                  <CardContent>
                    <Skeleton variant="text" width="60%" height={32} />
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="rectangular" height={80} sx={{ mt: 2, borderRadius: 2 }} />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : families.length === 0 ? (
          <Card>
            <CardContent>
              <Typography variant="h6" align="center" gutterBottom>
                No family trees yet
              </Typography>
              <Typography align="center" color="text.secondary">
                Create your first family tree to get started
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {families.map((family) => (
              <Grid item xs={12} sm={6} md={4} key={family.family_id}>
                <Card
                  sx={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => navigate(`/family/${family.family_id}/tree`)}
                >
                  <CardContent>
                    <Typography variant="h5" component="h2" gutterBottom>
                      {family.family_name}
                    </Typography>
                    {family.clan_name && (
                      <Typography color="text.secondary" gutterBottom>
                        Clan: {family.clan_name}
                      </Typography>
                    )}
                    {family.village_origin && (
                      <Typography color="text.secondary" gutterBottom>
                        Origin: {family.village_origin}
                      </Typography>
                    )}
                    <Typography variant="body2" color="text.secondary">
                      Role: {family.user_role}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default Dashboard;

