import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeModeProvider } from './contexts/ThemeModeContext';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Login from './pages/Login'; // Keep for backward compatibility
import Register from './pages/Register'; // Keep for backward compatibility
import Dashboard from './pages/Dashboard';
import FamilyTree from './pages/FamilyTree';
import PersonDetail from './pages/PersonDetail';
import FamilySettings from './pages/FamilySettings';
import AddPerson from './pages/AddPerson';
import ProfileCompletion from './pages/ProfileCompletion';
import ClaimPerson from './pages/ClaimPerson';

function App() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<SignIn />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/register" element={<SignUp />} />
            <Route path="/signup" element={<SignUp />} />
            {/* Keep old routes for backward compatibility */}
            <Route path="/old-login" element={<Login />} />
            <Route path="/old-register" element={<Register />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/family/:familyId/tree"
              element={
                <PrivateRoute>
                  <FamilyTree />
                </PrivateRoute>
              }
            />
            <Route
              path="/person/:personId"
              element={
                <PrivateRoute>
                  <PersonDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/family/:familyId/settings"
              element={
                <PrivateRoute>
                  <FamilySettings />
                </PrivateRoute>
              }
            />
            <Route
              path="/family/:familyId/add-person"
              element={
                <PrivateRoute>
                  <AddPerson />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile-completion"
              element={
                <PrivateRoute>
                  <ProfileCompletion />
                </PrivateRoute>
              }
            />
            <Route
              path="/claim/:token"
              element={<ClaimPerson />}
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeModeProvider>
  );
}

export default App;

