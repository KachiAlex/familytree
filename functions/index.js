const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const app = express();

// Allow CORS from any origin (you can restrict this later)
app.use(cors({ origin: true }));
app.use(express.json());

// JWT secret (for dev you can override via functions config or env)
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this-in-firebase-config';

// Helper: create error response from validation
const handleValidation = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return false;
  }
  return true;
};

// Auth middleware (JWT)
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Load user from Firestore
    const userSnap = await db.collection('users').doc(decoded.userId).get();
    if (!userSnap.exists) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = { user_id: userSnap.id, ...userSnap.data() };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Health check
app.get('/api/health', async (req, res) => {
  try {
    // Simple Firestore check
    await db.collection('healthChecks').doc('ping').set(
      { timestamp: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    res.json({
      status: 'ok',
      message: 'Firebase Functions API is running',
      environment: process.env.NODE_ENV || 'cloud',
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: 'Failed health check' });
  }
});

// AUTH ROUTES

// Register (family-first registration, using Firestore)
app.post(
  '/api/auth/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('full_name').notEmpty().trim(),
    body('family_name').notEmpty().trim(),
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;

      const { email, password, full_name, phone, family_name, clan_name, village_origin } = req.body;

      // Check if user exists
      const existingUserSnap = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (!existingUserSnap.empty) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }

      // Check if family name is already taken
      const existingFamilySnap = await db
        .collection('families')
        .where('family_name_lower', '==', family_name.toLowerCase())
        .limit(1)
        .get();

      if (!existingFamilySnap.empty) {
        return res.status(400).json({ error: 'Family name already taken. Please choose a different name.' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const userRef = db.collection('users').doc();
      await userRef.set({
        email,
        phone: phone || null,
        password_hash: passwordHash,
        full_name,
        role: 'member',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      const userId = userRef.id;

      // Free tier limits (simplified)
      const freeTier = {
        max_persons: 50,
        max_documents: 100,
        max_storage_mb: 500,
        max_members: 10,
      };

      // Create family
      const familyRef = db.collection('families').doc();
      await familyRef.set({
        family_name,
        family_name_lower: family_name.toLowerCase(),
        clan_name: clan_name || null,
        village_origin: village_origin || null,
        subscription_tier: 'free',
        subscription_status: 'active',
        subscription_start_date: admin.firestore.FieldValue.serverTimestamp(),
        subscription_end_date: null,
        ...freeTier,
        created_by_user_id: userId,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      const familyId = familyRef.id;

      // Add creator as admin in familyMembers
      const familyMemberRef = db.collection('familyMembers').doc();
      await familyMemberRef.set({
        family_id: familyId,
        user_id: userId,
        role: 'admin',
        invited_by: userId,
        joined_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Generate JWT
      const token = jwt.sign(
        { userId, email },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      res.status(201).json({
        message: 'Family and account created successfully',
        user: {
          user_id: userId,
          email,
          full_name,
          role: 'member',
          phone: phone || null,
        },
        family: {
          family_id: familyId,
          family_name,
          subscription_tier: 'free',
          subscription_status: 'active',
        },
        token,
      });
    } catch (error) {
      console.error('Registration error (functions):', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  },
);

// Login
app.post(
  '/api/auth/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      if (!handleValidation(req, res)) return;

      const { email, password } = req.body;

      // Find user by email
      const userSnap = await db
        .collection('users')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (userSnap.empty) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const userDoc = userSnap.docs[0];
      const user = userDoc.data();

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate token
      const token = jwt.sign(
        { userId: userDoc.id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' },
      );

      res.json({
        message: 'Login successful',
        user: {
          user_id: userDoc.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role || 'member',
        },
        token,
      });
    } catch (error) {
      console.error('Login error (functions):', error);
      res.status(500).json({ error: 'Login failed' });
    }
  },
);

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = req.user;
    res.json({
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role || 'member',
        phone: user.phone || null,
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Families: get families for current user
app.get('/api/families/my-families', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.user_id;

    // Find family memberships
    const membershipSnap = await db
      .collection('familyMembers')
      .where('user_id', '==', userId)
      .get();

    if (membershipSnap.empty) {
      return res.json({ families: [] });
    }

    const families = [];

    for (const membershipDoc of membershipSnap.docs) {
      const membership = membershipDoc.data();
      const familyRef = db.collection('families').doc(membership.family_id);
      const familySnap = await familyRef.get();
      if (!familySnap.exists) continue;
      const familyData = familySnap.data();
      families.push({
        family_id: familySnap.id,
        family_name: familyData.family_name,
        clan_name: familyData.clan_name || null,
        village_origin: familyData.village_origin || null,
        subscription_tier: familyData.subscription_tier || 'free',
        subscription_status: familyData.subscription_status || 'active',
        user_role: membership.role || 'member',
      });
    }

    res.json({ families });
  } catch (error) {
    console.error('Error fetching families (functions):', error);
    res.status(500).json({ error: 'Failed to fetch families' });
  }
});

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);


