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

const requireFamilyAccess = async (req, res, next) => {
  try {
    const familyId = req.params.familyId || req.body.family_id;
    if (!familyId) {
      return res.status(400).json({ error: 'Family ID required' });
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

