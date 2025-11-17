import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  LinearProgress,
  MenuItem,
  Card,
  CardContent,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { isProfileComplete } from '../utils/profileUtils';

const ProfileCompletion = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    date_of_birth: '',
    gender: '',
    place_of_birth: '',
    phone: '',
    occupation: '',
    biography: '',
    clan_name: '',
    village_origin: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Load current user profile
    const loadProfile = async () => {
      try {
        const userRef = doc(db, 'users', user.user_id);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const userData = snap.data();
          setFormData({
            full_name: userData.full_name || '',
            email: userData.email || '',
            date_of_birth: userData.date_of_birth || '',
            gender: userData.gender || '',
            place_of_birth: userData.place_of_birth || '',
            phone: userData.phone || '',
            occupation: userData.occupation || '',
            biography: userData.biography || '',
            clan_name: userData.clan_name || '',
            village_origin: userData.village_origin || '',
          });
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        setError('Failed to load your profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!formData.full_name || !formData.full_name.trim()) {
      setError('Full name is required');
      return;
    }

    if (!formData.email || !formData.email.trim()) {
      setError('Email is required');
      return;
    }

    setSaving(true);

    try {
      const userRef = doc(db, 'users', user.user_id);
      await updateDoc(userRef, {
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        date_of_birth: formData.date_of_birth || null,
        gender: formData.gender || null,
        place_of_birth: formData.place_of_birth || null,
        phone: formData.phone || null,
        occupation: formData.occupation || null,
        biography: formData.biography || null,
        clan_name: formData.clan_name || null,
        village_origin: formData.village_origin || null,
        updated_at: serverTimestamp(),
        profile_completed: true,
      });

      // Update user context
      const updatedUser = {
        ...user,
        ...formData,
        profile_completed: true,
      };
      setUser(updatedUser);

      setSuccess(true);
      setTimeout(() => {
        // Redirect to dashboard or return to previous page
        const returnTo = sessionStorage.getItem('returnAfterProfileCompletion') || '/dashboard';
        sessionStorage.removeItem('returnAfterProfileCompletion');
        navigate(returnTo);
      }, 1500);
    } catch (err) {
      console.error('Failed to save profile:', err);
      setError('Failed to save your profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography>Loading...</Typography>
      </Container>
    );
  }

  const profileStatus = isProfileComplete(formData);

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Complete Your Profile
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Before you can add family members to your tree, please complete your profile information.
          This helps us create a more accurate family tree.
        </Typography>

        {profileStatus.completionPercentage > 0 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Profile Completion</Typography>
              <Typography variant="body2" color="primary">
                {profileStatus.completionPercentage}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={profileStatus.completionPercentage}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Profile saved successfully! Redirecting...
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Required Information
              </Typography>
              <TextField
                fullWidth
                required
                margin="normal"
                label="Full Name *"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
              />
              <TextField
                fullWidth
                required
                margin="normal"
                label="Email *"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Personal Information
              </Typography>
              <TextField
                fullWidth
                margin="normal"
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                select
                fullWidth
                margin="normal"
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
              >
                <MenuItem value="">Not specified</MenuItem>
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
              <TextField
                fullWidth
                margin="normal"
                label="Place of Birth"
                name="place_of_birth"
                value={formData.place_of_birth}
                onChange={handleChange}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Phone Number"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Occupation"
                name="occupation"
                value={formData.occupation}
                onChange={handleChange}
              />
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Family & Heritage
              </Typography>
              <TextField
                fullWidth
                margin="normal"
                label="Clan Name"
                name="clan_name"
                value={formData.clan_name}
                onChange={handleChange}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Village/Town Origin"
                name="village_origin"
                value={formData.village_origin}
                onChange={handleChange}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Biography / Story"
                name="biography"
                multiline
                minRows={4}
                value={formData.biography}
                onChange={handleChange}
                helperText="Tell us about yourself and your family history"
              />
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() => navigate('/dashboard')}
              disabled={saving}
            >
              Skip for Now
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={saving || !formData.full_name || !formData.email}
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default ProfileCompletion;

