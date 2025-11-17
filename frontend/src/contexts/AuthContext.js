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
        // Load user profile from Firestore
        const userRef = doc(db, 'users', firebaseUser.uid);
        const snap = await getDoc(userRef);
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
        console.error('Failed to load user profile:', err);
        setUser(null);
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

      // Load profile from Firestore
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userRef);
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

