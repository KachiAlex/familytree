import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // Load user profile from Firestore with timeout
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Create a timeout promise that rejects after 5 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Firestore request timeout')), 5000);
        });
        
        // Race between getDoc and timeout
        const snap = await Promise.race([getDoc(userRef), timeoutPromise]);
        
        if (snap.exists()) {
          setUser({ user_id: firebaseUser.uid, ...snap.data() });
        } else {
          // Fallback: minimal user info
          setUser({
            user_id: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: firebaseUser.displayName || '',
            role: 'member',
          });
        }
      } catch (err) {
        // If Firestore is offline or times out, use Firebase Auth info as fallback
        // This allows the app to work in offline mode
        const isOfflineError = 
          err.code === 'unavailable' || 
          err.code === 'deadline-exceeded' ||
          err.message?.includes('timeout') ||
          err.message?.includes('offline') ||
          err.message?.includes('Could not reach Cloud Firestore');
        
        if (isOfflineError) {
          console.warn('Firestore offline - using Firebase Auth user info:', err.message);
          // Use Firebase Auth user info as fallback when offline
          setUser({
            user_id: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: firebaseUser.displayName || '',
            role: 'member',
          });
        } else {
          console.error('Failed to load user profile:', err);
          // Only set user to null for non-offline errors
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      try {
        // Load profile from Firestore with timeout
        const userRef = doc(db, 'users', firebaseUser.uid);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Firestore request timeout')), 5000);
        });
        const snap = await Promise.race([getDoc(userRef), timeoutPromise]);
        
        if (snap.exists()) {
          setUser({ user_id: firebaseUser.uid, ...snap.data() });
        } else {
          setUser({
            user_id: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: firebaseUser.displayName || '',
            role: 'member',
          });
        }
      } catch (firestoreError) {
        // If Firestore is offline, use Firebase Auth info
        const isOfflineError = 
          firestoreError.code === 'unavailable' || 
          firestoreError.code === 'deadline-exceeded' ||
          firestoreError.message?.includes('timeout') ||
          firestoreError.message?.includes('offline');
        
        if (isOfflineError) {
          console.warn('Firestore offline during login - using Firebase Auth info');
          setUser({
            user_id: firebaseUser.uid,
            email: firebaseUser.email,
            full_name: firebaseUser.displayName || '',
            role: 'member',
          });
        } else {
          throw firestoreError;
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Login failed',
      };
    }
  };

  const register = async (email, password, fullName, phone, familyName, clanName, villageOrigin) => {
    try {
      // Create Firebase Auth user
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = credential.user;

      // Update display name
      if (fullName) {
        await updateProfile(firebaseUser, { displayName: fullName });
      }

      // Create user profile in Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      await setDoc(userRef, {
        email,
        full_name: fullName,
        phone: phone || null,
        role: 'member',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      // Create family document (free tier)
      const familyRef = await addDoc(collection(db, 'families'), {
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
        created_by_user_id: firebaseUser.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });

      const familyId = familyRef.id;

      // Track membership for the family creator
      const membershipRef = doc(db, 'familyMembers', `${familyId}_${firebaseUser.uid}`);
      await setDoc(membershipRef, {
        family_id: familyId,
        user_id: firebaseUser.uid,
        role: 'admin',
        invited_by: firebaseUser.uid,
        status: 'active',
        joined_at: serverTimestamp(),
        created_at: serverTimestamp(),
      });

      const userData = {
        user_id: firebaseUser.uid,
        email,
        full_name: fullName,
        role: 'member',
        phone: phone || null,
      };

      setUser(userData);

      return {
        success: true,
        family: {
          family_id: familyId,
          family_name: familyName,
          subscription_tier: 'free',
          subscription_status: 'active',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Registration failed',
      };
    }
  };

  const logout = () => {
    signOut(auth);
    setUser(null);
  };

  const updateUser = (updatedUserData) => {
    setUser((prev) => (prev ? { ...prev, ...updatedUserData } : null));
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
    setUser,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

