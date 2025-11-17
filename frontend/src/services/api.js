import axios from 'axios';

// In production on Firebase Hosting, /api/* is rewritten to the Cloud Function `api`.
// For local development, set REACT_APP_API_URL=http://localhost:5000/api (or your emulator URL).
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export default api;

