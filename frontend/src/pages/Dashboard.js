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
import api from '../services/api';

const Logo = () => (
  <svg viewBox="0 0 200 200" width="28" height="28">
    <rect width="200" height="200" rx="44" fill="#22345E" />
    <line x1="100" y1="150" x2="70" y2="176" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="150" x2="100" y2="180" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="150" x2="130" y2="176" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="150" x2="100" y2="108" stroke="#F1E6D2" strokeWidth="5" strokeLinecap="round" />
    <line x1="100" y1="120" x2="62" y2="90" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="120" x2="100" y2="72" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
    <line x1="100" y1="120" x2="138" y2="90" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
    <circle cx="100" cy="66" r="11" fill="#D79A1E" />
    <circle cx="62" cy="90" r="8" fill="#3F6644" />
    <circle cx="138" cy="90" r="8" fill="#3F6644" />
  </svg>
);

const cardTopColors = ['#22345E', '#C1622D', '#3F6644', '#D79A1E', '#3A4F82'];

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
      if (authLoading) return;
      if (!user) {
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
      const res = await api.get('/families/my-families');
      setFamilies(res.data.families || []);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch families:', error);
      setError(`Failed to load families: ${error.response?.data?.error || error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchFamilies();
      } else {
        setLoading(false);
        setFamilies([]);
      }
    }
  }, [user, authLoading, fetchFamilies]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !authLoading) {
        fetchFamilies(true);
      }
    };
    const handleFocus = () => {
      if (user && !authLoading) {
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
    const familyName = prompt('Enter family name:');
    if (!familyName) return;
    const clanName = prompt('Enter clan name (optional):');
    const villageOrigin = prompt('Enter village/town of origin (optional):');
    try {
      const res = await api.post('/families', {
        family_name: familyName,
        clan_name: clanName || undefined,
        village_origin: villageOrigin || undefined,
      });
      await fetchFamilies();
      navigate(`/family/${res.data.family.family_id}/tree`);
    } catch (error) {
      console.error('Failed to create family:', error);
      setError(`Failed to create family: ${error.response?.data?.error || error.message || 'Unknown error'}. Please try again.`);
    }
  };

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);
  const handleLogout = () => { logout(); navigate('/login'); };

  const handleDeleteClick = (e, family) => {
    e.stopPropagation();
    setFamilyToDelete(family);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!familyToDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/families/${familyToDelete.family_id}`);
      setSnackbar({ open: true, message: `Family "${familyToDelete.family_name}" deleted successfully`, severity: 'success' });
      setDeleteDialogOpen(false);
      setFamilyToDelete(null);
      await fetchFamilies();
    } catch (error) {
      console.error('Failed to delete family:', error);
      setSnackbar({ open: true, message: `Failed to delete family: ${error.response?.data?.error || error.message || 'Unknown error'}`, severity: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => { setDeleteDialogOpen(false); setFamilyToDelete(null); };

  const userInitials = user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <>
      {/* Topbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 3, md: 4.5 }, py: 2, bgcolor: '#FFFFFF', borderBottom: '1px solid #E7DCC8' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>
          <Logo />
          Family Tree
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%', bgcolor: '#22345E', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12.5px', fontWeight: 600, fontFamily: "'Fraunces', serif",
            }}>
              {userInitials}
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

      {/* Main content */}
      <Box sx={{ px: { xs: 3, md: 5 }, py: { xs: 4, md: 5.5 }, maxWidth: 1180, mx: 'auto' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 32 }}>
              Your families
            </Typography>
            <Typography sx={{ color: '#5C5346', fontSize: 14, mt: 0.75 }}>
              Every tree you belong to, in one place.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button
              variant="outlined"
              startIcon={retrying ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={() => fetchFamilies(true)}
              disabled={retrying || loading}
              sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none', '&:hover': { borderColor: '#3A4F82' } }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateFamily}
              sx={{
                bgcolor: '#22345E', color: '#fff', fontWeight: 600, textTransform: 'none', fontSize: '13.5px',
                '&:hover': { bgcolor: '#22345E', transform: 'translateY(-2px)' },
              }}
            >
              + New family
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}
            action={<Button color="inherit" size="small" onClick={() => fetchFamilies(true)}>Retry</Button>}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Grid container spacing={2.75}>
            {[1, 2, 3].map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item}>
                <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', border: '1px solid #E7DCC8' }}>
                  <Skeleton variant="rectangular" height={64} />
                  <Box sx={{ p: 2.5 }}>
                    <Skeleton variant="text" width="60%" height={28} />
                    <Skeleton variant="text" width="40%" />
                    <Skeleton variant="rectangular" height={60} sx={{ mt: 2, borderRadius: 2 }} />
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        ) : families.length === 0 ? (
          <Box sx={{ bgcolor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E7DCC8', p: 6, textAlign: 'center' }}>
            <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, mb: 1 }}>
              No family trees yet
            </Typography>
            <Typography sx={{ color: '#5C5346' }}>
              Create your first family tree to get started
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2.75}>
            {families.map((family, idx) => {
              const userId = user?.user_id || user?.userId || user?.uid;
              const isOwner = family.user_role === 'admin' || family.created_by_user_id === userId;
              const topColor = cardTopColors[idx % cardTopColors.length];
              return (
                <Grid item xs={12} sm={6} md={4} key={family.family_id}>
                  <Box
                    sx={{
                      bgcolor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden',
                      border: '1px solid #E7DCC8', cursor: 'pointer',
                      transition: 'transform .15s ease, box-shadow .15s ease',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 32px rgba(28,20,16,.09)' },
                    }}
                    onClick={() => navigate(`/family/${family.family_id}/tree`)}
                  >
                    {/* Colored top bar with mini tree SVG */}
                    <Box sx={{ height: 64, display: 'flex', alignItems: 'center', px: 2.75, bgcolor: topColor }}>
                      <svg viewBox="0 0 60 60" width="38" height="38" style={{ opacity: 0.9 }}>
                        <circle cx="30" cy="14" r="7" fill={topColor === '#22345E' ? '#D79A1E' : topColor === '#C1622D' ? '#F7E5D8' : '#FBEFD6'} />
                        <line x1="30" y1="21" x2="18" y2="36" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" />
                        <line x1="30" y1="21" x2="42" y2="36" stroke="rgba(255,255,255,.5)" strokeWidth="2.5" />
                        <circle cx="18" cy="40" r="5" fill={topColor === '#22345E' ? '#3F6644' : 'rgba(255,255,255,.75)'} />
                        <circle cx="42" cy="40" r="5" fill={topColor === '#22345E' ? '#3F6644' : 'rgba(255,255,255,.75)'} />
                      </svg>
                    </Box>
                    {/* Card body */}
                    <Box sx={{ p: '20px 22px 22px' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5, gap: 1.25 }}>
                        <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18 }}>
                          {family.family_name}
                        </Typography>
                        <Box sx={{
                          fontSize: '10.5px', fontFamily: "'IBM Plex Mono', monospace",
                          px: 1.25, py: 0.5, borderRadius: '20px',
                          bgcolor: isOwner ? '#E7EFE6' : '#EAEEF6',
                          color: isOwner ? '#3F6644' : '#22345E',
                          textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                        }}>
                          {family.user_role || 'member'}
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: 13, color: '#5C5346', lineHeight: 1.55, mb: 2.25, minHeight: 38 }}>
                        {family.clan_name ? `Clan: ${family.clan_name}` : 'No clan set'}
                        {family.village_origin ? ` · ${family.village_origin}` : ''}
                      </Typography>
                      <Box sx={{
                        display: 'flex', gap: 2.5, fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: '11.5px', color: '#8C8171', borderTop: '1px dashed #E7DCC8', pt: 1.75,
                      }}>
                        {[
                          { label: 'members', value: family.person_count || 0 },
                          { label: 'generations', value: family.generation_count || 0 },
                          { label: 'stories', value: family.story_count || 0 },
                        ].map((stat, i) => (
                          <Box key={i}>
                            <Typography sx={{ color: '#1C1410', fontFamily: "'Work Sans', sans-serif", fontWeight: 700, fontSize: 16, display: 'block' }}>
                              {stat.value}
                            </Typography>
                            {stat.label}
                          </Box>
                        ))}
                      </Box>
                      {isOwner && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => handleDeleteClick(e, family)}
                            disabled={deleting}
                            sx={{ fontSize: 12, textTransform: 'none', color: '#C1622D' }}
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
                  minHeight: 220, borderRadius: '16px',
                  border: '1.5px dashed #E7DCC8',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 1.5, color: '#8C8171', cursor: 'pointer', bgcolor: 'transparent',
                  transition: 'border-color .15s, color .15s',
                  '&:hover': { borderColor: '#3A4F82', color: '#22345E' },
                }}
              >
                <Box sx={{
                  width: 42, height: 42, borderRadius: '50%', bgcolor: '#FBEFD6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, color: '#D79A1E',
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
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle id="delete-dialog-title" sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
          Delete Family Tree?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete <strong>{familyToDelete?.family_name}</strong>?
            This will delete all persons, relationships, documents, stories, and other data associated with this family tree.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleDeleteCancel} disabled={deleting} variant="outlined" sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <DeleteIcon />}
            sx={{ bgcolor: '#C1622D', textTransform: 'none' }}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default Dashboard;
