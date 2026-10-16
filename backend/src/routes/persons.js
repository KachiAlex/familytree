const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');
const { checkResourceLimit } = require('../middleware/tierLimits');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const { uploadToR2 } = require('../utils/s3');
const { notifyProfileOwnerOfPendingChange } = require('../utils/pendingNotify');
const router = express.Router();

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// Get all persons in a family
router.get('/family/:familyId', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM persons 
       WHERE family_id = $1 
       ORDER BY date_of_birth ASC NULLS LAST`,
      [familyId]
    );

    res.json({ persons: result.rows });
  } catch (error) {
    console.error('Error fetching persons:', error);
    res.status(500).json({ error: 'Failed to fetch persons' });
  }
});

// Get single person with relationships
router.get('/:personId', requireFamilyAccess, async (req, res) => {
  try {
    const { personId } = req.params;

    // Get person
    const personResult = await pool.query(
      'SELECT * FROM persons WHERE person_id = $1',
      [personId]
    );

    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const person = personResult.rows[0];

    // Get relationships
    const relationshipsResult = await pool.query(
      `SELECT r.*,
              row_to_json(p1.*) as person1_data,
              row_to_json(p2.*) as person2_data
       FROM relationships r
       JOIN persons p1 ON r.person1_id = p1.person_id
       JOIN persons p2 ON r.person2_id = p2.person_id
       WHERE r.person1_id = $1 OR r.person2_id = $1`,
      [personId]
    );

    // Get documents
    const documentsResult = await pool.query(
      'SELECT * FROM documents WHERE person_id = $1 ORDER BY created_at DESC',
      [personId]
    );

    // Get stories
    const storiesResult = await pool.query(
      'SELECT * FROM stories WHERE person_id = $1 ORDER BY created_at DESC',
      [personId]
    );

    res.json({
      person,
      relationships: relationshipsResult.rows,
      documents: documentsResult.rows,
      stories: storiesResult.rows
    });
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({ error: 'Failed to fetch person' });
  }
});

// Create person
router.post('/', [
  body('full_name').notEmpty().trim(),
  body('family_id').isInt()
], requireFamilyAccess, checkResourceLimit('person'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      family_id,
      full_name,
      gender,
      date_of_birth,
      date_of_death,
      alive_status,
      profile_photo_url,
      place_of_birth,
      occupation,
      biography,
      clan_name,
      village_origin,
      migration_history
    } = req.body;

    const result = await pool.query(
      `INSERT INTO persons (
        family_id, full_name, gender, date_of_birth, date_of_death,
        alive_status, profile_photo_url, place_of_birth, occupation,
        biography, clan_name, village_origin, migration_history,
        created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        family_id, full_name, gender, date_of_birth, date_of_death,
        alive_status !== undefined ? alive_status : true,
        profile_photo_url, place_of_birth, occupation,
        biography, clan_name, village_origin,
        migration_history ? JSON.stringify(migration_history) : null,
        req.user.user_id
      ]
    );

    res.status(201).json({
      message: 'Person created successfully',
      person: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating person:', error);
    res.status(500).json({ error: 'Failed to create person' });
  }
});

// Update person
router.put('/:personId', requireFamilyAccess, async (req, res) => {
  try {
    const { personId } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const allowedFields = [
      'full_name', 'gender', 'date_of_birth', 'date_of_death',
      'alive_status', 'profile_photo_url', 'place_of_birth',
      'occupation', 'biography', 'clan_name', 'village_origin',
      'migration_history', 'verified_by_elder', 'verified_by_user_id'
    ];

    // Claimed profiles: edits by anyone other than the owning account are
    // converted into pending changes that only the owner can confirm.
    const currentResult = await pool.query(
      'SELECT * FROM persons WHERE person_id = $1',
      [personId]
    );
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const current = currentResult.rows[0];

    if (current.owner_user_id && current.owner_user_id !== req.user.user_id) {
      const norm = (v) => (v === null || v === undefined || v === '' ? null : String(v).trim());
      const changes = {};
      const changedFields = [];
      for (const field of allowedFields) {
        if (updates[field] === undefined) continue;
        if (norm(current[field]) !== norm(updates[field])) {
          changes[field] = { old: current[field] === undefined ? null : current[field], new: updates[field] };
          changedFields.push(field);
        }
      }
      if (changedFields.length === 0) {
        return res.json({ message: 'No changes detected', person: current });
      }

      const conflictResult = await pool.query(
        `SELECT pending_change_id, changed_fields FROM pending_changes
         WHERE person_id = $1 AND status = 'pending'`,
        [personId]
      );
      const conflicts = [];
      conflictResult.rows.forEach((row) => {
        if (changedFields.some((f) => (row.changed_fields || []).includes(f))) {
          conflicts.push(row.pending_change_id);
        }
      });

      const pendingResult = await pool.query(
        `INSERT INTO pending_changes (person_id, family_id, changed_by_user_id, changes, changed_fields, reason, conflicts_with)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [personId, current.family_id, req.user.user_id, JSON.stringify(changes), changedFields, updates.reason || null, conflicts]
      );

      await notifyProfileOwnerOfPendingChange({
        ownerUserId: current.owner_user_id,
        personId,
        personName: current.full_name,
        changerName: req.user.full_name || req.user.email,
        summary: `Profile edit: ${changedFields.join(', ')}`,
      });

      return res.status(202).json({
        pending: true,
        message: 'This profile is managed by its account owner. Your change was submitted for their confirmation.',
        pendingChange: pendingResult.rows[0]
      });
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        if (field === 'migration_history' && typeof updates[field] === 'object') {
          values.push(JSON.stringify(updates[field]));
        } else {
          values.push(updates[field]);
        }
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(personId);

    const result = await pool.query(
      `UPDATE persons 
       SET ${updateFields.join(', ')}
       WHERE person_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json({
      message: 'Person updated successfully',
      person: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({ error: 'Failed to update person' });
  }
});

// Delete person
router.delete('/:personId', requireFamilyAccess, async (req, res) => {
  try {
    const { personId } = req.params;

    // Claimed profiles: deletion by anyone other than the owning account is
    // a pending change that only the owner can confirm.
    const personResult = await pool.query(
      'SELECT * FROM persons WHERE person_id = $1',
      [personId]
    );
    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }
    const target = personResult.rows[0];

    if (target.owner_user_id && target.owner_user_id !== req.user.user_id) {
      const pendingResult = await pool.query(
        `INSERT INTO pending_changes (person_id, family_id, changed_by_user_id, changes, changed_fields, reason, change_type, payload)
         VALUES ($1, $2, $3, $4, $5, $6, 'delete', NULL)
         RETURNING *`,
        [personId, target.family_id, req.user.user_id,
         JSON.stringify({ profile: { old: 'Active', new: 'Delete profile' } }),
         ['delete'], req.body?.reason || null]
      );

      await notifyProfileOwnerOfPendingChange({
        ownerUserId: target.owner_user_id,
        personId,
        personName: target.full_name,
        changerName: req.user.full_name || req.user.email,
        summary: 'Requested deletion of this profile',
      });

      return res.status(202).json({
        pending: true,
        message: 'This profile is managed by its account owner. The deletion was submitted for their confirmation.',
        pendingChange: pendingResult.rows[0]
      });
    }

    const result = await pool.query(
      'DELETE FROM persons WHERE person_id = $1 RETURNING person_id',
      [personId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    res.json({ message: 'Person deleted successfully' });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({ error: 'Failed to delete person' });
  }
});

// Claim a person profile (set owner_user_id). Requires family membership,
// which is granted by accepting an invitation first.
router.post('/:personId/claim', requireFamilyAccess, async (req, res) => {
  try {
    const { personId } = req.params;

    // Check if person exists and doesn't already have an owner
    const personResult = await pool.query('SELECT * FROM persons WHERE person_id = $1', [personId]);
    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    if (personResult.rows[0].owner_user_id) {
      return res.status(400).json({ error: 'This person profile has already been claimed' });
    }

    // Set the owner
    const result = await pool.query(
      'UPDATE persons SET owner_user_id = $1, updated_at = CURRENT_TIMESTAMP WHERE person_id = $2 RETURNING *',
      [req.user.user_id, personId]
    );

    res.json({
      message: 'Person profile claimed successfully',
      person: result.rows[0]
    });
  } catch (error) {
    console.error('Error claiming person:', error);
    res.status(500).json({ error: 'Failed to claim person profile' });
  }
});

// Upload profile photo
router.post('/:personId/profile-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { personId } = req.params;
    const userId = req.user.user_id;

    // Get person's info and family admin info
    const personResult = await pool.query(
      `SELECT p.family_id, p.owner_user_id, p.created_by_user_id, p.full_name,
              p.profile_photo_url, f.created_by_user_id as family_creator_id
       FROM persons p
       JOIN families f ON p.family_id = f.family_id
       WHERE p.person_id = $1`, 
      [personId]
    );
    
    if (personResult.rows.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const person = personResult.rows[0];
    const familyId = person.family_id;

    // Check permissions:
    // 1. Is the owner of the profile?
    // 2. Is the one who created the profile?
    // 3. Is the family creator?
    // 4. (Optional) Is an elder in the family?
    const isOwner = person.owner_user_id === userId;
    const isCreator = person.created_by_user_id === userId;
    const isFamilyAdmin = person.family_creator_id === userId;

    if (!isOwner && !isCreator && !isFamilyAdmin) {
      return res.status(403).json({ error: 'You do not have permission to update this avatar' });
    }

    // Upload to R2
    const fileKey = `avatars/${personId}-${Date.now()}-${req.file.originalname}`;
    const s3Result = await uploadToR2(req.file, fileKey);

    // Claimed profiles: a photo proposed by anyone other than the owning
    // account is published only after the owner confirms it.
    if (person.owner_user_id && person.owner_user_id !== userId) {
      const pendingResult = await pool.query(
        `INSERT INTO pending_changes (person_id, family_id, changed_by_user_id, changes, changed_fields, reason, change_type, payload)
         VALUES ($1, $2, $3, $4, $5, $6, 'photo', $7)
         RETURNING *`,
        [personId, familyId, userId,
         JSON.stringify({ profile_photo_url: { old: person.profile_photo_url || null, new: s3Result.Location } }),
         ['profile_photo_url'], req.body?.reason || null,
         JSON.stringify({ photo_url: s3Result.Location, file_key: fileKey })]
      );

      await notifyProfileOwnerOfPendingChange({
        ownerUserId: person.owner_user_id,
        personId,
        personName: person.full_name,
        changerName: req.user.full_name || req.user.email,
        summary: 'Proposed a new profile photo',
      });

      return res.status(202).json({
        pending: true,
        message: 'This profile is managed by its account owner. The new photo was submitted for their confirmation.',
        pendingChange: pendingResult.rows[0]
      });
    }

    // Update person's profile_photo_url
    const result = await pool.query(
      'UPDATE persons SET profile_photo_url = $1, updated_at = CURRENT_TIMESTAMP WHERE person_id = $2 RETURNING *',
      [s3Result.Location, personId]
    );

    res.json({
      message: 'Profile photo uploaded successfully',
      person: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    res.status(500).json({ error: 'Failed to upload profile photo' });
  }
});

// Gendered kin term describing a path node relative to the previous node
const edgeTerm = (kind, gender) => {
  const g = (gender || '').toLowerCase();
  const f = g === 'female' || g === 'f';
  const m = g === 'male' || g === 'm';
  switch (kind) {
    case 'parent': return f ? 'mother' : m ? 'father' : 'parent';
    case 'child': return f ? 'daughter' : m ? 'son' : 'child';
    case 'spouse': return f ? 'wife' : m ? 'husband' : 'spouse';
    case 'sibling': return f ? 'sister' : m ? 'brother' : 'sibling';
    case 'cousin': return 'cousin';
    case 'uncle_aunt': return f ? 'aunt' : m ? 'uncle' : 'uncle/aunt';
    case 'niece_nephew': return f ? 'niece' : m ? 'nephew' : 'niece/nephew';
    case 'in_law': return 'in-law';
    default: return kind;
  }
};

// Canonical kinship label for common path shapes, or null when the path is
// best described by its steps (e.g. "your father's sister's son").
const summarizeKinship = (kinds, targetGender) => {
  const term = edgeTerm;
  const g = targetGender;
  const key = kinds.join(',');
  const direct = {
    'parent': term('parent', g),
    'child': term('child', g),
    'spouse': term('spouse', g),
    'sibling': term('sibling', g),
    'cousin': 'cousin',
    'uncle_aunt': term('uncle_aunt', g),
    'niece_nephew': term('niece_nephew', g),
    'in_law': 'in-law',
    'parent,parent': g === 'female' ? 'grandmother' : g === 'male' ? 'grandfather' : 'grandparent',
    'child,child': g === 'female' ? 'granddaughter' : g === 'male' ? 'grandson' : 'grandchild',
    'parent,sibling': g === 'female' ? 'aunt' : g === 'male' ? 'uncle' : 'aunt/uncle',
    'sibling,child': g === 'female' ? 'niece' : g === 'male' ? 'nephew' : 'niece/nephew',
    'parent,spouse': g === 'female' ? 'stepmother' : g === 'male' ? 'stepfather' : 'stepparent',
    'spouse,parent': g === 'female' ? 'mother-in-law' : g === 'male' ? 'father-in-law' : 'parent-in-law',
    'spouse,sibling': g === 'female' ? 'sister-in-law' : g === 'male' ? 'brother-in-law' : 'sibling-in-law',
    'sibling,spouse': g === 'female' ? 'sister-in-law' : g === 'male' ? 'brother-in-law' : 'sibling-in-law',
    'child,spouse': g === 'female' ? 'daughter-in-law' : g === 'male' ? 'son-in-law' : 'child-in-law',
    'parent,sibling,child': 'first cousin',
    'uncle_aunt,child': 'first cousin',
    'parent,parent,sibling': g === 'female' ? 'grandaunt' : g === 'male' ? 'granduncle' : 'grandaunt/granduncle',
    'sibling,child,child': g === 'female' ? 'grandniece' : g === 'male' ? 'grandnephew' : 'grandniece/grandnephew',
  };
  if (direct[key]) return direct[key];

  // N generations straight up or straight down
  if (kinds.every(k => k === 'parent') && kinds.length >= 3) {
    const greats = 'great-'.repeat(kinds.length - 2);
    return `${greats}grand${g === 'female' ? 'mother' : g === 'male' ? 'father' : 'parent'}`;
  }
  if (kinds.every(k => k === 'child') && kinds.length >= 3) {
    const greats = 'great-'.repeat(kinds.length - 2);
    return `${greats}grand${g === 'female' ? 'daughter' : g === 'male' ? 'son' : 'child'}`;
  }

  // Up through parents then down through children — kin via a shared
  // ancestor (this is how sibling/cousin paths resolve in this model, since
  // siblings are derived from shared parents rather than direct edges).
  const firstChild = kinds.indexOf('child');
  if (firstChild > 0 &&
      kinds.slice(0, firstChild).every(k => k === 'parent') &&
      kinds.slice(firstChild).every(k => k === 'child')) {
    const a = firstChild;
    const b = kinds.length - firstChild;
    if (a === 1 && b === 1) return `${term('sibling', g)} (or half-sibling)`;
    if (a === 2 && b === 1) return term('uncle_aunt', g);
    if (a === 1 && b === 2) return term('niece_nephew', g);
    const degree = Math.min(a, b) - 1;
    const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
    const ord = ordinals[degree - 1] || `${degree}th`;
    const removed = Math.abs(a - b);
    return `${ord} cousin${removed ? ` ${removed}x removed` : ''}`;
  }

  // Cousin pattern: up through parents, across a sibling/uncle_aunt edge,
  // back down through children.
  const sibIdx = kinds.findIndex(k => k === 'sibling' || k === 'uncle_aunt');
  if (sibIdx > 0 &&
      kinds.slice(0, sibIdx).every(k => k === 'parent') &&
      kinds.slice(sibIdx + 1).every(k => k === 'child')) {
    const ups = sibIdx, downs = kinds.length - sibIdx - 1;
    const degree = Math.min(ups, downs);
    const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
    const ord = ordinals[degree - 1] || `${degree}th`;
    const removed = Math.abs(ups - downs);
    return `${ord} cousin${removed ? ` ${removed}x removed` : ''}`;
  }

  return null;
};

// "How are we related?" — shortest kinship path between two persons in the
// same family tree (BFS over the relationships graph).
router.get('/:personId/kinship/:otherId', requireFamilyAccess, async (req, res) => {
  try {
    const personId = parseInt(req.params.personId, 10);
    const otherId = parseInt(req.params.otherId, 10);
    if (personId === otherId) {
      return res.status(400).json({ error: 'Choose a different person' });
    }

    const personsResult = await pool.query(
      'SELECT person_id, family_id, full_name, gender FROM persons WHERE person_id = ANY($1)',
      [[personId, otherId]]
    );
    const from = personsResult.rows.find((r) => r.person_id === personId);
    const to = personsResult.rows.find((r) => r.person_id === otherId);
    if (!from || !to) {
      return res.status(404).json({ error: 'Person not found' });
    }
    if (from.family_id !== to.family_id) {
      return res.status(400).json({ error: 'These persons are not in the same family tree' });
    }

    const rels = await pool.query(
      `SELECT r.person1_id, r.person2_id, r.relationship_type
       FROM relationships r
       JOIN persons p ON p.person_id = r.person1_id
       WHERE p.family_id = $1`,
      [from.family_id]
    );

    // Adjacency: edge kind describes the neighbor relative to the node.
    // Convention: parent edges have person1=parent, person2=child;
    // uncle_aunt edges have person1=elder, person2=junior.
    const adj = new Map();
    const link = (a, b, kind) => {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a).push({ to: b, kind });
    };
    for (const r of rels.rows) {
      switch (r.relationship_type) {
        case 'parent':
          link(r.person1_id, r.person2_id, 'child');
          link(r.person2_id, r.person1_id, 'parent');
          break;
        case 'uncle_aunt':
          link(r.person1_id, r.person2_id, 'niece_nephew');
          link(r.person2_id, r.person1_id, 'uncle_aunt');
          break;
        default:
          link(r.person1_id, r.person2_id, r.relationship_type);
          link(r.person2_id, r.person1_id, r.relationship_type);
      }
    }

    const prev = new Map([[personId, null]]);
    const queue = [personId];
    let found = false;
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === otherId) { found = true; break; }
      for (const e of adj.get(cur) || []) {
        if (!prev.has(e.to)) {
          prev.set(e.to, { fromId: cur, kind: e.kind });
          queue.push(e.to);
        }
      }
    }

    if (!found) {
      return res.json({ related: false, path: [], degree: null, summary: null });
    }

    const ids = [];
    for (let n = otherId; n != null; n = prev.get(n) ? prev.get(n).fromId : null) {
      ids.unshift(n);
    }
    const names = await pool.query(
      'SELECT person_id, full_name, gender FROM persons WHERE person_id = ANY($1)',
      [ids]
    );
    const byId = Object.fromEntries(names.rows.map((r) => [r.person_id, r]));
    const path = ids.map((id, i) => ({
      person_id: id,
      full_name: byId[id] ? byId[id].full_name : null,
      gender: byId[id] ? byId[id].gender : null,
      via: i === 0 ? null : edgeTerm(prev.get(id).kind, byId[id] ? byId[id].gender : null),
    }));
    const kinds = ids.slice(1).map((id) => prev.get(id).kind);

    res.json({
      related: true,
      degree: ids.length - 1,
      path,
      summary: summarizeKinship(kinds, to.gender),
    });
  } catch (error) {
    console.error('Error computing kinship path:', error);
    res.status(500).json({ error: 'Failed to compute relationship path' });
  }
});

// Generate a narrative biography from recorded facts + stories via Gemini.
// Returns draft text — the client previews it and applies through the normal
// PUT route, so claimed-profile owner-confirmation still applies.
router.post('/:personId/generate-bio', requireFamilyAccess, async (req, res) => {
  try {
    const { personId } = req.params;
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Biography generation is not configured' });
    }

    const { rows } = await pool.query(
      `SELECT person_id, family_id, full_name, gender, date_of_birth, date_of_death,
              alive_status, place_of_birth, occupation, biography, clan_name, village_origin
       FROM persons WHERE person_id = $1`,
      [personId]
    );
    const person = rows[0];
    if (!person) return res.status(404).json({ error: 'Person not found' });

    const { rows: rels } = await pool.query(
      `SELECT r.relationship_type, p.full_name, p.gender
       FROM relationships r
       JOIN persons p ON p.person_id = CASE WHEN r.person1_id = $1 THEN r.person2_id ELSE r.person1_id END
       WHERE r.person1_id = $1 OR r.person2_id = $1`,
      [personId]
    );

    const { rows: stories } = await pool.query(
      `SELECT title, story_text FROM stories
       WHERE person_id = $1 AND story_text IS NOT NULL AND story_text <> ''
       ORDER BY created_at DESC LIMIT 8`,
      [personId]
    );

    const { getGeminiModel } = require('../utils/gemini');
    const model = getGeminiModel();

    const facts = [
      `Name: ${person.full_name}`,
      person.gender && `Gender: ${person.gender}`,
      person.date_of_birth && `Born: ${person.date_of_birth}`,
      person.place_of_birth && `Place of birth: ${person.place_of_birth}`,
      person.date_of_death && `Died: ${person.date_of_death}`,
      person.occupation && `Occupation: ${person.occupation}`,
      person.clan_name && `Clan: ${person.clan_name}`,
      person.village_origin && `Village of origin: ${person.village_origin}`,
      rels.length && `Family: ${rels.slice(0, 12).map((r) => `${r.full_name} (${r.relationship_type})`).join(', ')}`,
      stories.length && `Recorded stories: ${stories.map((s) => `"${s.title || 'Untitled'}": ${String(s.story_text).slice(0, 300)}`).join(' | ')}`,
    ].filter(Boolean).join('\n');

    const result = await model.generateContent(
      `Write a respectful 2-3 paragraph narrative biography for this family member, honoring African oral-tradition storytelling. Use only the facts below; do not invent events. Where facts are sparse, lean on the recorded stories. Plain prose, no headings.\n\n${facts}`
    );

    res.json({ biography: result.response.text().trim(), sources: { relatives: rels.length, stories: stories.length } });
  } catch (error) {
    console.error('Error generating biography:', error.message);
    res.status(500).json({ error: 'Failed to generate biography' });
  }
});

module.exports = router;

