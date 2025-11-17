const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.use(authenticateToken);

// Get all relationships for a family
router.get('/family/:familyId', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;

    const result = await pool.query(
      `SELECT r.*, 
              p1.full_name as person1_name,
              p2.full_name as person2_name
       FROM relationships r
       JOIN persons p1 ON r.person1_id = p1.person_id
       JOIN persons p2 ON r.person2_id = p2.person_id
       WHERE p1.family_id = $1 AND p2.family_id = $1`,
      [familyId]
    );

    res.json({ relationships: result.rows });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ error: 'Failed to fetch relationships' });
  }
});

// Create relationship
router.post('/', [
  body('person1_id').isInt(),
  body('person2_id').isInt(),
  body('relationship_type').isIn(['parent', 'spouse', 'sibling', 'cousin', 'uncle_aunt', 'in_law'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { person1_id, person2_id, relationship_type, notes } = req.body;

    if (person1_id === person2_id) {
      return res.status(400).json({ error: 'A person cannot have a relationship with themselves' });
    }

    // Verify both persons exist and user has access
    const personsResult = await pool.query(
      `SELECT p1.family_id as family1, p2.family_id as family2
       FROM persons p1, persons p2
       WHERE p1.person_id = $1 AND p2.person_id = $2`,
      [person1_id, person2_id]
    );

    if (personsResult.rows.length === 0) {
      return res.status(404).json({ error: 'One or both persons not found' });
    }

    // Check if relationship already exists
    const existingResult = await pool.query(
      `SELECT relationship_id FROM relationships
       WHERE ((person1_id = $1 AND person2_id = $2) OR (person1_id = $2 AND person2_id = $1))
       AND relationship_type = $3`,
      [person1_id, person2_id, relationship_type]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Relationship already exists' });
    }

    // Create relationship (always store with smaller ID first for consistency)
    const [id1, id2] = person1_id < person2_id ? [person1_id, person2_id] : [person2_id, person1_id];

    const result = await pool.query(
      `INSERT INTO relationships (person1_id, person2_id, relationship_type, notes, verified_by_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id1, id2, relationship_type, notes || null, req.user.user_id]
    );

    res.status(201).json({
      message: 'Relationship created successfully',
      relationship: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating relationship:', error);
    if (error.code === '23505') { // Unique constraint violation
      return res.status(400).json({ error: 'Relationship already exists' });
    }
    res.status(500).json({ error: 'Failed to create relationship' });
  }
});

// Update relationship
router.put('/:relationshipId', async (req, res) => {
  try {
    const { relationshipId } = req.params;
    const { verified, notes } = req.body;

    const result = await pool.query(
      `UPDATE relationships 
       SET verified = COALESCE($1, verified),
           notes = COALESCE($2, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE relationship_id = $3
       RETURNING *`,
      [verified, notes, relationshipId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    res.json({
      message: 'Relationship updated successfully',
      relationship: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating relationship:', error);
    res.status(500).json({ error: 'Failed to update relationship' });
  }
});

// Delete relationship
router.delete('/:relationshipId', async (req, res) => {
  try {
    const { relationshipId } = req.params;

    const result = await pool.query(
      'DELETE FROM relationships WHERE relationship_id = $1 RETURNING relationship_id',
      [relationshipId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Relationship not found' });
    }

    res.json({ message: 'Relationship deleted successfully' });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    res.status(500).json({ error: 'Failed to delete relationship' });
  }
});

module.exports = router;

