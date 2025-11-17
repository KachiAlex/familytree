import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    familyName: '',
    clanName: '',
    villageOrigin: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    const result = await register(
      formData.email,
      formData.password,
      formData.fullName,
      formData.phone,
      formData.familyName,
      formData.clanName,
      formData.villageOrigin
    );

    if (result.success) {
      // Navigate to the family tree after successful registration
      if (result.family) {
        navigate(`/family/${result.family.family_id}/tree`);
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Register Your Family
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
            Create your family tree account (Free tier included)
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <TextField
              fullWidth
              label="Full Name"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Phone (Optional)"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              margin="normal"
            />
            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              Family Information
            </Typography>
            <TextField
              fullWidth
              required
              label="Family Name"
              name="familyName"
              value={formData.familyName}
              onChange={handleChange}
              margin="normal"
              helperText="This will be your family tree name"
            />
            <TextField
              fullWidth
              label="Clan Name (Optional)"
              name="clanName"
              value={formData.clanName}
              onChange={handleChange}
              margin="normal"
              placeholder="e.g., Umunna, Idile"
            />
            <TextField
              fullWidth
              label="Village/Town Origin (Optional)"
              name="villageOrigin"
              value={formData.villageOrigin}
              onChange={handleChange}
              margin="normal"
            />
            <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
              Account Password
            </Typography>
            <TextField
              fullWidth
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              margin="normal"
            />
            <TextField
              fullWidth
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              margin="normal"
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Register'}
            </Button>
            <Typography align="center">
              Already have an account? <Link to="/login">Login</Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register;

