const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/connection');
const { body, validationResult } = require('express-validator');
const { getTierLimits } = require('../config/tiers');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Register an invited user (joins existing family via invitation, no family_name required)
router.post('/register/invited', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').notEmpty().trim(),
  body('invitation_token').notEmpty().trim()
], async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, full_name, phone, invitation_token } = req.body;

    // Check if user exists
    const existingUser = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    // Validate invitation
    const inviteResult = await client.query(
      'SELECT * FROM invitations WHERE token = $1 AND status = $2',
      [invitation_token, 'pending']
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const invitation = inviteResult.rows[0];

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This invitation has expired' });
    }

    if (invitation.email !== email) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Email does not match the invitation' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user account
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email, full_name, role`,
      [email, passwordHash, full_name, phone || null]
    );

    const user = userResult.rows[0];

    // Add user as family member
    await client.query(
      `INSERT INTO family_members (family_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)`,
      [invitation.family_id, user.user_id, invitation.role || 'member', invitation.invited_by_user_id]
    );

    // Mark invitation as accepted
    await client.query(
      `UPDATE invitations SET status = 'accepted' WHERE invitation_id = $1`,
      [invitation.invitation_id]
    );

    await client.query('COMMIT');

    // Generate token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      user,
      token
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Invited registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// Family Registration (Multi-tenant: Family-first registration)
router.post('/register', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('full_name').notEmpty().trim(),
  body('family_name').notEmpty().trim()
], async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, full_name, phone, family_name, clan_name, village_origin } = req.body;

    // Check if user exists
    const existingUser = await client.query(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if family name is already taken
    const existingFamily = await client.query(
      'SELECT family_id FROM families WHERE LOWER(family_name) = LOWER($1)',
      [family_name]
    );

    if (existingFamily.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Family name already taken. Please choose a different name.' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user account
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING user_id, email, full_name, role`,
      [email, passwordHash, full_name, phone || null]
    );

    const user = userResult.rows[0];

    // Get free tier limits
    const freeTierLimits = getTierLimits('free');

    // Create family with free tier
    const familyResult = await client.query(
      `INSERT INTO families (
        family_name, clan_name, village_origin, 
        subscription_tier, subscription_status,
        max_persons, max_documents, max_storage_mb, max_members,
        created_by_user_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        family_name,
        clan_name || null,
        village_origin || null,
        'free',
        'active',
        freeTierLimits.max_persons,
        freeTierLimits.max_documents,
        freeTierLimits.max_storage_mb,
        freeTierLimits.max_members,
        user.user_id
      ]
    );

    const family = familyResult.rows[0];

    // Add creator as admin
    await client.query(
      `INSERT INTO family_members (family_id, user_id, role, invited_by)
       VALUES ($1, $2, 'admin', $2)`,
      [family.family_id, user.user_id]
    );

    await client.query('COMMIT');

    // Generate token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Family and account created successfully',
      user,
      family: {
        family_id: family.family_id,
        family_name: family.family_name,
        subscription_tier: family.subscription_tier,
        subscription_status: family.subscription_status
      },
      token
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
});

// Login
router.post('/login', authLimiter, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const result = await pool.query(
      'SELECT user_id, email, password_hash, full_name, role FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await pool.query(
      `SELECT user_id, email, full_name, role, phone, date_of_birth, gender, 
              place_of_birth, occupation, biography, clan_name, village_origin, 
              profile_completed
       FROM users WHERE user_id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Update current user profile
router.put('/me', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const {
      full_name,
      phone,
      date_of_birth,
      gender,
      place_of_birth,
      occupation,
      biography,
      clan_name,
      village_origin,
      profile_completed
    } = req.body;

    const result = await pool.query(
      `UPDATE users 
       SET full_name = COALESCE($1, full_name),
           phone = COALESCE($2, phone),
           date_of_birth = COALESCE($3, date_of_birth),
           gender = COALESCE($4, gender),
           place_of_birth = COALESCE($5, place_of_birth),
           occupation = COALESCE($6, occupation),
           biography = COALESCE($7, biography),
           clan_name = COALESCE($8, clan_name),
           village_origin = COALESCE($9, village_origin),
           profile_completed = COALESCE($10, profile_completed),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $11
       RETURNING user_id, email, full_name, role, phone, date_of_birth, gender, place_of_birth, occupation, biography, clan_name, village_origin, profile_completed`,
      [full_name, phone, date_of_birth, gender, place_of_birth, occupation, biography, clan_name, village_origin, profile_completed, decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;

