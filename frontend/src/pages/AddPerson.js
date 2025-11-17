import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Autocomplete,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { isProfileComplete } from '../utils/profileUtils';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

const AddPerson = () => {
  const { familyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    gender: '',
    date_of_birth: '',
    date_of_death: '',
    alive_status: true,
    place_of_birth: '',
    occupation: '',
    biography: '',
    clan_name: '',
    village_origin: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commonValues, setCommonValues] = useState({
    clan_names: [],
    village_origins: [],
    places_of_birth: [],
    occupations: [],
  });

  // Check profile completion on mount
  useEffect(() => {
    if (user) {
      const profileStatus = isProfileComplete(user);
      if (!profileStatus.isComplete) {
        sessionStorage.setItem('returnAfterProfileCompletion', `/family/${familyId}/add-person`);
        navigate('/profile-completion');
      }
    }
  }, [user, navigate, familyId]);

  // Fetch common values from existing family members
  useEffect(() => {
    const fetchCommonValues = async () => {
      try {
        const personsRef = collection(db, 'persons');
        const personsQuery = query(personsRef, where('family_id', '==', familyId));
        const snap = await getDocs(personsQuery);
        
        const clans = new Set();
        const villages = new Set();
        const places = new Set();
        const occupations = new Set();

        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.clan_name) clans.add(data.clan_name);
          if (data.village_origin) villages.add(data.village_origin);
          if (data.place_of_birth) places.add(data.place_of_birth);
          if (data.occupation) occupations.add(data.occupation);
        });

        setCommonValues({
          clan_names: Array.from(clans).sort(),
          village_origins: Array.from(villages).sort(),
          places_of_birth: Array.from(places).sort(),
          occupations: Array.from(occupations).sort(),
        });
      } catch (err) {
        console.error('Failed to fetch common values:', err);
      }
    };

    if (familyId) {
      fetchCommonValues();
    }
  }, [familyId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'alive_status' ? value === 'true' : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const personsRef = collection(db, 'persons');
      const docRef = await addDoc(personsRef, {
        ...formData,
        family_id: familyId,
        date_of_birth: formData.date_of_birth || null,
        date_of_death: formData.date_of_death || null,
        created_at: serverTimestamp(),
      });

      navigate(`/person/${docRef.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create person');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>
          Add Family Member
        </Typography>

        {error && (
          <Box sx={{ mt: 2, mb: 2, p: 2, bgcolor: 'error.light', color: 'error.contrastText', borderRadius: 1 }}>
            {error}
          </Box>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Full Name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Gender</InputLabel>
                <Select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  label="Gender"
                >
                  <MenuItem value="male">Male</MenuItem>
                  <MenuItem value="female">Female</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="alive_status"
                  value={formData.alive_status.toString()}
                  onChange={handleChange}
                  label="Status"
                >
                  <MenuItem value="true">Alive</MenuItem>
                  <MenuItem value="false">Deceased</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={formData.date_of_birth}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date of Death"
                name="date_of_death"
                type="date"
                value={formData.date_of_death}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                disabled={formData.alive_status}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={commonValues.places_of_birth}
                value={formData.place_of_birth || null}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, place_of_birth: newValue || '' });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Place of Birth"
                    name="place_of_birth"
                    helperText={commonValues.places_of_birth.length > 0 ? `Common: ${commonValues.places_of_birth.slice(0, 3).join(', ')}` : ''}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={commonValues.occupations}
                value={formData.occupation || null}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, occupation: newValue || '' });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Occupation"
                    name="occupation"
                    helperText={commonValues.occupations.length > 0 ? `Common: ${commonValues.occupations.slice(0, 3).join(', ')}` : ''}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={commonValues.clan_names}
                value={formData.clan_name || null}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, clan_name: newValue || '' });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Clan Name"
                    name="clan_name"
                    placeholder="e.g., Umunna, Idile"
                    helperText={commonValues.clan_names.length > 0 ? `Common in family: ${commonValues.clan_names.join(', ')}` : ''}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                freeSolo
                options={commonValues.village_origins}
                value={formData.village_origin || null}
                onChange={(event, newValue) => {
                  setFormData({ ...formData, village_origin: newValue || '' });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    label="Village/Town Origin"
                    name="village_origin"
                    helperText={commonValues.village_origins.length > 0 ? `Common in family: ${commonValues.village_origins.join(', ')}` : ''}
                  />
                )}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Biography / Story"
                name="biography"
                value={formData.biography}
                onChange={handleChange}
                placeholder="Tell the story of this family member..."
              />
            </Grid>

            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  onClick={() => navigate(-1)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Add Person'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
};

export default AddPerson;

