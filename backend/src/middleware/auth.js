const jwt = require('jsonwebtoken');
const { pool } = require('../db/connection');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists
    const result = await pool.query(
      'SELECT user_id, email, full_name, role FROM users WHERE user_id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Resolve the owning family_id from whatever resource id is present in the
// request (params take precedence over body). Used by requireFamilyAccess so
// person/document/story/relationship scoped routes get the same check.
const resolveFamilyId = async (req) => {
  if (req.params.familyId || req.body.family_id) {
    return req.params.familyId || req.body.family_id;
  }
  if (req.params.personId) {
    const r = await pool.query('SELECT family_id FROM persons WHERE person_id = $1', [req.params.personId]);
    return r.rows.length ? r.rows[0].family_id : null;
  }
  if (req.params.documentId) {
    const r = await pool.query('SELECT family_id FROM documents WHERE document_id = $1', [req.params.documentId]);
    return r.rows.length ? r.rows[0].family_id : null;
  }
  if (req.params.storyId) {
    const r = await pool.query('SELECT family_id FROM stories WHERE story_id = $1', [req.params.storyId]);
    return r.rows.length ? r.rows[0].family_id : null;
  }
  if (req.params.relationshipId) {
    const r = await pool.query(
      `SELECT p.family_id FROM relationships r
       JOIN persons p ON p.person_id = r.person1_id
       WHERE r.relationship_id = $1`,
      [req.params.relationshipId]
    );
    return r.rows.length ? r.rows[0].family_id : null;
  }
  if (req.params.pendingChangeId) {
    const r = await pool.query('SELECT family_id FROM pending_changes WHERE pending_change_id = $1', [req.params.pendingChangeId]);
    return r.rows.length ? r.rows[0].family_id : null;
  }
  return null;
};

const requireFamilyAccess = async (req, res, next) => {
  try {
    const familyId = await resolveFamilyId(req);

    if (!familyId) {
      return res.status(404).json({ error: 'Resource not found' });
    }

    const result = await pool.query(
      `SELECT role FROM family_members 
       WHERE family_id = $1 AND user_id = $2`,
      [familyId, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this family tree' });
    }

    req.familyRole = result.rows[0].role;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authorization error' });
  }
};

module.exports = {
  authenticateToken,
  requireFamilyAccess
};

