const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken } = require('../middleware/auth');
const { checkResourceLimit, getFamilyUsageInfo } = require('../middleware/tierLimits');
const { getTierLimits } = require('../config/tiers');
const crypto = require('crypto');

const router = express.Router();
router.use(authenticateToken);

// Create family (additional families - also get free tier)
router.post('/', async (req, res) => {
  try {
    const { family_name, clan_name, village_origin } = req.body;

    // Check if family name is already taken
    const existingFamily = await pool.query(
      'SELECT family_id FROM families WHERE LOWER(family_name) = LOWER($1)',
      [family_name]
    );

    if (existingFamily.rows.length > 0) {
      return res.status(400).json({ error: 'Family name already taken. Please choose a different name.' });
    }

    // Get free tier limits
    const freeTierLimits = getTierLimits('free');

    const result = await pool.query(
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
        req.user.user_id
      ]
    );

    const family = result.rows[0];

    // Add creator as admin
    await pool.query(
      `INSERT INTO family_members (family_id, user_id, role, invited_by)
       VALUES ($1, $2, 'admin', $2)`,
      [family.family_id, req.user.user_id]
    );

    res.status(201).json({
      message: 'Family created successfully',
      family
    });
  } catch (error) {
    console.error('Error creating family:', error);
    res.status(500).json({ error: 'Failed to create family' });
  }
});

// Get user's families
router.get('/my-families', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, fm.role as user_role
       FROM families f
       JOIN family_members fm ON f.family_id = fm.family_id
       WHERE fm.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.user_id]
    );

    res.json({ families: result.rows });
  } catch (error) {
    console.error('Error fetching families:', error);
    res.status(500).json({ error: 'Failed to fetch families' });
  }
});

// Get family details with usage info
router.get('/:familyId', getFamilyUsageInfo, async (req, res) => {
  try {
    const { familyId } = req.params;

    // Check access
    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.user.user_id]
    );

    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get family info
    const familyResult = await pool.query(
      'SELECT * FROM families WHERE family_id = $1',
      [familyId]
    );

    // Get members
    const membersResult = await pool.query(
      `SELECT u.user_id, u.full_name, u.email, fm.role, fm.joined_at
       FROM family_members fm
       JOIN users u ON fm.user_id = u.user_id
       WHERE fm.family_id = $1
       ORDER BY fm.joined_at ASC`,
      [familyId]
    );

    res.json({
      family: familyResult.rows[0],
      members: membersResult.rows,
      userRole: memberCheck.rows[0].role,
      usage: req.familyUsage
    });
  } catch (error) {
    console.error('Error fetching family:', error);
    res.status(500).json({ error: 'Failed to fetch family' });
  }
});

// Invite member
router.post('/:familyId/invite', checkResourceLimit('member'), async (req, res) => {
  try {
    const { familyId } = req.params;
    const { email, phone, role = 'member' } = req.body;

    // Check if user is admin
    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.user.user_id]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can invite members' });
    }

    // Generate invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await pool.query(
      `INSERT INTO invitations (family_id, email, phone, invited_by_user_id, token, role, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [familyId, email, phone || null, req.user.user_id, token, role, expiresAt]
    );

    // TODO: Send invitation email/SMS

    res.json({
      message: 'Invitation sent successfully',
      invitationToken: token // In production, send via email
    });
  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// Accept invitation
router.post('/invite/accept/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const inviteResult = await pool.query(
      'SELECT * FROM invitations WHERE token = $1 AND status = $2 AND expires_at > NOW()',
      [token, 'pending']
    );

    if (inviteResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const invitation = inviteResult.rows[0];

    // Add user to family
    await pool.query(
      `INSERT INTO family_members (family_id, user_id, role, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (family_id, user_id) DO NOTHING`,
      [invitation.family_id, req.user.user_id, invitation.role, invitation.invited_by_user_id]
    );

    // Update invitation status
    await pool.query(
      'UPDATE invitations SET status = $1 WHERE invitation_id = $2',
      ['accepted', invitation.invitation_id]
    );

    res.json({ message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

module.exports = router;

