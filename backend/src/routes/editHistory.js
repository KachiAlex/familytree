const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Create a pending change
router.post('/pending', async (req, res) => {
  try {
    const { person_id, family_id, changes, changed_fields, reason } = req.body;

    if (!person_id || !family_id || !changes || !changed_fields) {
      return res.status(400).json({ error: 'person_id, family_id, changes, and changed_fields are required' });
    }

    // Check for conflicts with other pending changes on the same person
    const conflictResult = await pool.query(
      `SELECT pending_change_id, changed_fields FROM pending_changes
       WHERE person_id = $1 AND status = 'pending'`,
      [person_id]
    );

    const conflicts = [];
    conflictResult.rows.forEach((row) => {
      const pendingFields = row.changed_fields || [];
      const hasConflict = changed_fields.some((field) => pendingFields.includes(field));
      if (hasConflict) {
        conflicts.push(row.pending_change_id);
      }
    });

    const result = await pool.query(
      `INSERT INTO pending_changes (person_id, family_id, changed_by_user_id, changes, changed_fields, reason, conflicts_with)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [person_id, family_id, req.user.user_id, JSON.stringify(changes), changed_fields, reason || null, conflicts]
    );

    res.status(201).json({
      message: 'Pending change created successfully',
      pendingChange: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating pending change:', error);
    res.status(500).json({ error: 'Failed to create pending change' });
  }
});

// Get pending changes for a person
router.get('/pending/person/:personId', async (req, res) => {
  try {
    const { personId } = req.params;

    const result = await pool.query(
      `SELECT pc.*, u.full_name as changed_by_name
       FROM pending_changes pc
       LEFT JOIN users u ON pc.changed_by_user_id = u.user_id
       WHERE pc.person_id = $1 AND pc.status = 'pending'
       ORDER BY pc.created_at DESC`,
      [personId]
    );

    res.json({ pendingChanges: result.rows });
  } catch (error) {
    console.error('Error fetching pending changes:', error);
    res.status(500).json({ error: 'Failed to fetch pending changes' });
  }
});

// Get pending changes for a family
router.get('/pending/family/:familyId', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;

    const result = await pool.query(
      `SELECT pc.*, u.full_name as changed_by_name, p.full_name as person_name
       FROM pending_changes pc
       LEFT JOIN users u ON pc.changed_by_user_id = u.user_id
       LEFT JOIN persons p ON pc.person_id = p.person_id
       WHERE pc.family_id = $1 AND pc.status = 'pending'
       ORDER BY pc.created_at DESC`,
      [familyId]
    );

    res.json({ pendingChanges: result.rows });
  } catch (error) {
    console.error('Error fetching family pending changes:', error);
    res.status(500).json({ error: 'Failed to fetch pending changes' });
  }
});

// Approve a pending change
router.post('/pending/:pendingChangeId/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    const { pendingChangeId } = req.params;
    const { approval_notes } = req.body;

    await client.query('BEGIN');

    // Fetch the pending change
    const pcResult = await client.query(
      'SELECT * FROM pending_changes WHERE pending_change_id = $1 AND status = $2',
      [pendingChangeId, 'pending']
    );

    if (pcResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Pending change not found or already resolved' });
    }

    const pendingChange = pcResult.rows[0];
    const changes = pendingChange.changes;

    // Validate field names before applying to prevent SQL injection
    const allowedFields = [
      'full_name', 'gender', 'date_of_birth', 'date_of_death',
      'alive_status', 'profile_photo_url', 'place_of_birth',
      'occupation', 'biography', 'clan_name', 'village_origin',
      'migration_history', 'verified_by_elder', 'verified_by_user_id'
    ];

    const invalidFields = Object.keys(changes).filter(f => !allowedFields.includes(f));
    if (invalidFields.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Invalid fields in pending change: ${invalidFields.join(', ')}` });
    }

    // Apply changes to the person
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    Object.keys(changes).forEach((field) => {
      updateFields.push(`${field} = $${paramIndex}`);
      const value = changes[field].new;
      if (field === 'migration_history' && typeof value === 'object') {
        updateValues.push(JSON.stringify(value));
      } else {
        updateValues.push(value);
      }
      paramIndex++;
    });

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    updateValues.push(pendingChange.person_id);

    await client.query(
      `UPDATE persons SET ${updateFields.join(', ')} WHERE person_id = $${paramIndex}`,
      updateValues
    );

    // Record in edit history
    await client.query(
      `INSERT INTO edit_history (person_id, family_id, changed_by_user_id, approved_by_user_id, changes, reason, approval_notes, status, approved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'approved', CURRENT_TIMESTAMP)`,
      [
        pendingChange.person_id,
        pendingChange.family_id,
        pendingChange.changed_by_user_id,
        req.user.user_id,
        JSON.stringify(changes),
        pendingChange.reason,
        approval_notes || null
      ]
    );

    // Mark pending change as approved
    await client.query(
      `UPDATE pending_changes SET status = 'approved', approved_by_user_id = $1, approved_at = CURRENT_TIMESTAMP, approval_notes = $2, updated_at = CURRENT_TIMESTAMP WHERE pending_change_id = $3`,
      [req.user.user_id, approval_notes || null, pendingChangeId]
    );

    // Reject conflicting pending changes
    if (pendingChange.conflicts_with && pendingChange.conflicts_with.length > 0) {
      for (const conflictId of pendingChange.conflicts_with) {
        await client.query(
          `UPDATE pending_changes SET status = 'rejected', rejected_by_user_id = $1, rejected_at = CURRENT_TIMESTAMP, rejection_reason = 'Conflicting change was approved', updated_at = CURRENT_TIMESTAMP WHERE pending_change_id = $2 AND status = 'pending'`,
          [req.user.user_id, conflictId]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Pending change approved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error approving pending change:', error);
    res.status(500).json({ error: 'Failed to approve pending change' });
  } finally {
    client.release();
  }
});

// Reject a pending change
router.post('/pending/:pendingChangeId/reject', async (req, res) => {
  try {
    const { pendingChangeId } = req.params;
    const { rejection_reason } = req.body;

    const result = await pool.query(
      `UPDATE pending_changes 
       SET status = 'rejected', rejected_by_user_id = $1, rejected_at = CURRENT_TIMESTAMP, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE pending_change_id = $3 AND status = 'pending'
       RETURNING *`,
      [req.user.user_id, rejection_reason || null, pendingChangeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending change not found or already resolved' });
    }

    res.json({ message: 'Pending change rejected successfully' });
  } catch (error) {
    console.error('Error rejecting pending change:', error);
    res.status(500).json({ error: 'Failed to reject pending change' });
  }
});

// Get edit history for a person
router.get('/person/:personId', async (req, res) => {
  try {
    const { personId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const result = await pool.query(
      `SELECT eh.*, u1.full_name as changed_by_name, u2.full_name as approved_by_name
       FROM edit_history eh
       LEFT JOIN users u1 ON eh.changed_by_user_id = u1.user_id
       LEFT JOIN users u2 ON eh.approved_by_user_id = u2.user_id
       WHERE eh.person_id = $1
       ORDER BY eh.created_at DESC
       LIMIT $2`,
      [personId, limit]
    );

    res.json({ editHistory: result.rows });
  } catch (error) {
    console.error('Error fetching edit history:', error);
    res.status(500).json({ error: 'Failed to fetch edit history' });
  }
});

// Get edit history for a family
router.get('/family/:familyId', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const result = await pool.query(
      `SELECT eh.*, u1.full_name as changed_by_name, u2.full_name as approved_by_name, p.full_name as person_name
       FROM edit_history eh
       LEFT JOIN users u1 ON eh.changed_by_user_id = u1.user_id
       LEFT JOIN users u2 ON eh.approved_by_user_id = u2.user_id
       LEFT JOIN persons p ON eh.person_id = p.person_id
       WHERE eh.family_id = $1
       ORDER BY eh.created_at DESC
       LIMIT $2`,
      [familyId, limit]
    );

    res.json({ editHistory: result.rows });
  } catch (error) {
    console.error('Error fetching family edit history:', error);
    res.status(500).json({ error: 'Failed to fetch edit history' });
  }
});

module.exports = router;
