import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Button,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Skeleton,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
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
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

const Dashboard = () => {
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [familyToDelete, setFamilyToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
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
        setError('Unable to determine user. Please re-login.');
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

  const handleDeleteClick = (e, family) => {
    e.stopPropagation(); // Prevent card click navigation
    setFamilyToDelete(family);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!familyToDelete) return;

    setDeleting(true);
    try {
      const familyId = familyToDelete.family_id;
      const userId = user?.user_id || user?.userId || user?.uid;
      
      // Verify ownership before attempting deletion
      const familyRef = doc(db, 'families', familyId);
      const familySnap = await getDoc(familyRef);
      
      if (!familySnap.exists()) {
        throw new Error('Family not found');
      }
      
      const familyData = familySnap.data();
      if (familyData.created_by_user_id !== userId) {
        throw new Error('You do not have permission to delete this family. Only the family owner can delete it.');
      }
      
      const BATCH_LIMIT = 500; // Firestore batch limit
      const allRefs = [];

      // Collect all document references to delete (excluding family document)
      const collections = [
        { name: 'persons', query: query(collection(db, 'persons'), where('family_id', '==', familyId)) },
        { name: 'relationships', query: query(collection(db, 'relationships'), where('family_id', '==', familyId)) },
        { name: 'spouseRelationships', query: query(collection(db, 'spouseRelationships'), where('family_id', '==', familyId)) },
        { name: 'familyMembers', query: query(collection(db, 'familyMembers'), where('family_id', '==', familyId)) },
        { name: 'documents', query: query(collection(db, 'documents'), where('family_id', '==', familyId)) },
        { name: 'stories', query: query(collection(db, 'stories'), where('family_id', '==', familyId)) },
        { name: 'verifications', query: query(collection(db, 'verifications'), where('family_id', '==', familyId)) },
        { name: 'personInvitations', query: query(collection(db, 'personInvitations'), where('family_id', '==', familyId)) },
      ];

      // Fetch all related documents
      for (const coll of collections) {
        try {
          const snap = await getDocs(coll.query);
          snap.docs.forEach((docSnap) => {
            allRefs.push(docSnap.ref);
          });
        } catch (error) {
          console.warn(`Error fetching ${coll.name}:`, error);
          // Continue with other collections even if one fails
        }
      }

      // Delete all related documents in batches first
      for (let i = 0; i < allRefs.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db);
        const batchRefs = allRefs.slice(i, i + BATCH_LIMIT);
        batchRefs.forEach((ref) => {
          batch.delete(ref);
        });
        await batch.commit();
      }

      // Delete the family document itself last (separate operation)
      // This ensures the isFamilyOwner() check can still read the family document
      await deleteDoc(familyRef);

      setSnackbar({ 
        open: true, 
        message: `Family "${familyToDelete.family_name}" deleted successfully`, 
        severity: 'success' 
      });
      setDeleteDialogOpen(false);
      setFamilyToDelete(null);
      await fetchFamilies();
    } catch (error) {
      console.error('Failed to delete family:', error);
      setSnackbar({ 
        open: true, 
        message: `Failed to delete family: ${error.message || 'Unknown error'}`, 
        severity: 'error' 
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setFamilyToDelete(null);
  };

  return (
    <>
      {/* Topbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 3, md: 5 }, py: 2.25, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: '#E4D3B0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box component="img" src="/family-tree-icon.svg" alt="Family Tree" sx={{ width: 26, height: 26 }} />
          <Typography variant="h6" sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 19 }}>
            Family Tree
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ThemeToggleButton />
          <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%', bgcolor: '#22345E', color: '#FFFDF9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, fontFamily: "'Fraunces', serif",
            }}>
              {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
            </Box>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
            <MenuItem disabled>{user?.full_name}</MenuItem>
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Box>
      </Box>

      {/* Thread band */}
      <div className="thread-band thin" />

      {/* Main content */}
      <Box sx={{ px: { xs: 3, md: 5 }, py: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 3.5, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h1" sx={{ fontSize: 30 }}>
              Your families
            </Typography>
            <Typography sx={{ color: '#5A5042', fontSize: 14, mt: 0.75 }}>
              Every tree you belong to, in one place.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={retrying ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={() => fetchFamilies(true)}
              disabled={retrying || loading}
              sx={{ borderColor: '#D8BF92', color: '#5A5042' }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateFamily}
            >
              New family
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3, borderRadius: 2 }}
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
          <Grid container spacing={2.5}>
            {[1, 2, 3].map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item}>
                <Box sx={{ bgcolor: 'background.paper', borderRadius: '14px', overflow: 'hidden', border: '1px solid', borderColor: '#E4D3B0' }}>
                  <Skeleton variant="rectangular" height={6} />
                  <Box sx={{ p: 2.75 }}>
                    <Skeleton variant="text" width="60%" height={28} />
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="rectangular" height={60} sx={{ mt: 2, borderRadius: 2 }} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : families.length === 0 ? (
          <Box sx={{ bgcolor: 'background.paper', borderRadius: '14px', border: '1px solid', borderColor: '#E4D3B0', p: 6, textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontFamily: "'Fraunces', serif", mb: 1 }}>
              No family trees yet
            </Typography>
            <Typography sx={{ color: '#5A5042' }}>
              Create your first family tree to get started
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2.5}>
            {families.map((family) => {
              const userId = user?.user_id || user?.userId || user?.uid;
              const isOwner = family.user_role === 'admin' || family.created_by_user_id === userId;
              return (
                <Grid item xs={12} sm={6} md={4} key={family.family_id}>
                  <Box
                    sx={{
                      bgcolor: 'background.paper', borderRadius: '14px', overflow: 'hidden',
                      border: '1px solid', borderColor: '#E4D3B0', cursor: 'pointer',
                      transition: 'transform 0.12s, box-shadow 0.12s',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(28,20,16,0.08)' },
                    }}
                    onClick={() => navigate(`/family/${family.family_id}/tree`)}
                  >
                    <div className="thread-band thin" />
                    <Box sx={{ p: 2.75 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.75 }}>
                        <Typography variant="h4" sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>
                          {family.family_name}
                        </Typography>
                        <Box sx={{
                          fontSize: '10.5px', fontFamily: "'IBM Plex Mono', monospace",
                          px: 1.125, py: 0.375, borderRadius: '20px',
                          bgcolor: family.user_role === 'admin' ? '#E4EDE4' : '#E8ECF4',
                          color: family.user_role === 'admin' ? '#3F6644' : '#22345E',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {family.user_role || 'member'}
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: 13, color: '#5A5042', lineHeight: 1.5, mb: 2, minHeight: 38 }}>
                        {family.clan_name ? `Clan: ${family.clan_name}` : 'No clan set'}
                        {family.village_origin ? ` · ${family.village_origin}` : ''}
                      </Typography>
                      {isOwner && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => handleDeleteClick(e, family)}
                            disabled={deleting}
                            sx={{ fontSize: 12, textTransform: 'none' }}
                          >
                            Delete
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
            {/* New family card */}
            <Grid item xs={12} sm={6} md={4}>
              <Box
                onClick={handleCreateFamily}
                sx={{
                  minHeight: 172, borderRadius: '14px',
                  border: '1.5px dashed', borderColor: '#D8BF92',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 1.25, color: '#7A6D5C', cursor: 'pointer', bgcolor: 'transparent',
                  transition: 'border-color 0.15s, color 0.15s',
                  '&:hover': { borderColor: '#B8541F', color: '#B8541F' },
                }}
              >
                <Box sx={{
                  width: 38, height: 38, borderRadius: '50%', bgcolor: '#F1E6D2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, color: '#B8541F',
                }}>
                  +
                </Box>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                  Start a new family tree
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%', borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{ sx: { borderRadius: '14px' } }}
      >
        <DialogTitle id="delete-dialog-title" sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
          Delete Family Tree?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to permanently delete <strong>{familyToDelete?.family_name}</strong>?
            This will delete all persons, relationships, documents, stories, and other data associated with this family tree.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleDeleteCancel} disabled={deleting} variant="outlined" sx={{ borderColor: '#D8BF92', color: '#5A5042' }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Dashboard;

