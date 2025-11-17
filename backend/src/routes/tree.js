const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken);

// Get tree data for visualization (graph format)
router.get('/family/:familyId', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;
    const { viewType = 'vertical' } = req.query;

    // Get all persons in family
    const personsResult = await pool.query(
      `SELECT person_id, full_name, gender, date_of_birth, date_of_death,
              alive_status, profile_photo_url, place_of_birth, occupation,
              biography, clan_name, village_origin
       FROM persons 
       WHERE family_id = $1
       ORDER BY date_of_birth ASC NULLS LAST`,
      [familyId]
    );

    // Get all relationships
    const relationshipsResult = await pool.query(
      `SELECT r.relationship_id, r.person1_id, r.person2_id, r.relationship_type,
              r.verified, r.notes
       FROM relationships r
       JOIN persons p1 ON r.person1_id = p1.person_id
       JOIN persons p2 ON r.person2_id = p2.person_id
       WHERE p1.family_id = $1 AND p2.family_id = $1`,
      [familyId]
    );

    // Build graph structure
    const nodes = personsResult.rows.map(person => ({
      id: person.person_id,
      data: {
        ...person,
        label: person.full_name
      }
    }));

    const edges = relationshipsResult.rows.map(rel => ({
      id: rel.relationship_id,
      source: rel.person1_id.toString(),
      target: rel.person2_id.toString(),
      type: rel.relationship_type,
      verified: rel.verified,
      label: rel.relationship_type
    }));

    // Find root nodes (persons with no parents)
    const parentIds = new Set();
    relationshipsResult.rows.forEach(rel => {
      if (rel.relationship_type === 'parent') {
        parentIds.add(rel.person2_id); // person2 is the child
      }
    });

    const rootNodes = nodes.filter(node => !parentIds.has(node.id));

    res.json({
      nodes,
      edges,
      rootNodes: rootNodes.map(n => n.id),
      viewType
    });
  } catch (error) {
    console.error('Error fetching tree data:', error);
    res.status(500).json({ error: 'Failed to fetch tree data' });
  }
});

// Get timeline data
router.get('/family/:familyId/timeline', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;

    const result = await pool.query(
      `SELECT 
        person_id,
        full_name,
        'birth' as event_type,
        date_of_birth as event_date,
        place_of_birth as location
       FROM persons
       WHERE family_id = $1 AND date_of_birth IS NOT NULL
       
       UNION ALL
       
       SELECT 
        person_id,
        full_name,
        'death' as event_type,
        date_of_death as event_date,
        NULL as location
       FROM persons
       WHERE family_id = $1 AND date_of_death IS NOT NULL
       
       ORDER BY event_date ASC`,
      [familyId]
    );

    res.json({ timeline: result.rows });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

// Get person's ancestors (for radial view)
router.get('/person/:personId/ancestors', async (req, res) => {
  try {
    const { personId } = req.params;
    const maxDepth = parseInt(req.query.depth) || 5;

    // Recursive query to get ancestors
    const result = await pool.query(
      `WITH RECURSIVE ancestors AS (
        SELECT person_id, full_name, gender, date_of_birth, date_of_death,
               profile_photo_url, 0 as depth, person_id as root_id
        FROM persons
        WHERE person_id = $1
        
        UNION ALL
        
        SELECT p.person_id, p.full_name, p.gender, p.date_of_birth, p.date_of_death,
               p.profile_photo_url, a.depth + 1, a.root_id
        FROM persons p
        JOIN relationships r ON r.person2_id = p.person_id
        JOIN ancestors a ON r.person1_id = a.person_id
        WHERE r.relationship_type = 'parent' AND a.depth < $2
      )
      SELECT * FROM ancestors ORDER BY depth, date_of_birth`,
      [personId, maxDepth]
    );

    res.json({ ancestors: result.rows });
  } catch (error) {
    console.error('Error fetching ancestors:', error);
    res.status(500).json({ error: 'Failed to fetch ancestors' });
  }
});

// Get person's descendants
router.get('/person/:personId/descendants', async (req, res) => {
  try {
    const { personId } = req.params;
    const maxDepth = parseInt(req.query.depth) || 5;

    const result = await pool.query(
      `WITH RECURSIVE descendants AS (
        SELECT person_id, full_name, gender, date_of_birth, date_of_death,
               profile_photo_url, 0 as depth, person_id as root_id
        FROM persons
        WHERE person_id = $1
        
        UNION ALL
        
        SELECT p.person_id, p.full_name, p.gender, p.date_of_birth, p.date_of_death,
               p.profile_photo_url, d.depth + 1, d.root_id
        FROM persons p
        JOIN relationships r ON r.person1_id = p.person_id
        JOIN descendants d ON r.person2_id = d.person_id
        WHERE r.relationship_type = 'parent' AND d.depth < $2
      )
      SELECT * FROM descendants ORDER BY depth, date_of_birth`,
      [personId, maxDepth]
    );

    res.json({ descendants: result.rows });
  } catch (error) {
    console.error('Error fetching descendants:', error);
    res.status(500).json({ error: 'Failed to fetch descendants' });
  }
});

module.exports = router;

