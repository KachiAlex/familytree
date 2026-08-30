const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');
const { checkResourceLimit } = require('../middleware/tierLimits');
const router = express.Router();

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
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
router.get('/:personId', async (req, res) => {
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

// Claim a person profile (set owner_user_id)
router.post('/:personId/claim', async (req, res) => {
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
router.post('/:personId/profile-photo', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { personId } = req.params;
    const userId = req.user.user_id;

    // Get person's info and family admin info
    const personResult = await pool.query(
      `SELECT p.family_id, p.owner_user_id, p.created_by_user_id, f.created_by_user_id as family_creator_id
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

    // Upload to S3
    const fileKey = `profiles/${familyId}/${Date.now()}-${req.file.originalname}`;
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    };

    const s3Result = await s3.upload(uploadParams).promise();

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

module.exports = router;

