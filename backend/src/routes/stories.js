const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');
const { checkResourceLimit } = require('../middleware/tierLimits');
const multer = require('multer');
const AWS = require('aws-sdk');

const router = express.Router();
router.use(authenticateToken);

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB for audio
});

// Get stories for a person
router.get('/person/:personId', async (req, res) => {
  try {
    const { personId } = req.params;

    const result = await pool.query(
      'SELECT * FROM stories WHERE person_id = $1 ORDER BY created_at DESC',
      [personId]
    );

    res.json({ stories: result.rows });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Get stories for a family
router.get('/family/:familyId', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;

    const result = await pool.query(
      `SELECT s.*, p.full_name as person_name
       FROM stories s
       LEFT JOIN persons p ON s.person_id = p.person_id
       WHERE s.family_id = $1
       ORDER BY s.created_at DESC`,
      [familyId]
    );

    res.json({ stories: result.rows });
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// Create story (with optional audio upload)
router.post('/', upload.single('audio'), requireFamilyAccess, checkResourceLimit('story'), async (req, res) => {
  try {
    const {
      person_id,
      family_id,
      title,
      story_text,
      narrator_name,
      narrator_relationship,
      recorded_date,
      location,
      tags
    } = req.body;

    let audioUrl = null;

    // Upload audio if provided
    if (req.file) {
      const fileKey = `stories/${family_id}/${Date.now()}-${req.file.originalname}`;
      const uploadParams = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: 'public-read'
      };

      const s3Result = await s3.upload(uploadParams).promise();
      audioUrl = s3Result.Location;
    }

    const result = await pool.query(
      `INSERT INTO stories (
        person_id, family_id, title, story_text, audio_url,
        narrator_name, narrator_relationship, recorded_date,
        location, tags, created_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        person_id || null,
        family_id,
        title,
        story_text || null,
        audioUrl,
        narrator_name || null,
        narrator_relationship || null,
        recorded_date || null,
        location || null,
        tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : null,
        req.user.user_id
      ]
    );

    res.status(201).json({
      message: 'Story created successfully',
      story: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating story:', error);
    res.status(500).json({ error: 'Failed to create story' });
  }
});

// Update story
router.put('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    const updates = req.body;

    const allowedFields = [
      'title', 'story_text', 'narrator_name', 'narrator_relationship',
      'recorded_date', 'location', 'tags', 'transcription'
    ];

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        if (field === 'tags' && typeof updates[field] === 'object') {
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
    values.push(storyId);

    const result = await pool.query(
      `UPDATE stories 
       SET ${updateFields.join(', ')}
       WHERE story_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    res.json({
      message: 'Story updated successfully',
      story: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating story:', error);
    res.status(500).json({ error: 'Failed to update story' });
  }
});

// Delete story
router.delete('/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;

    // Get story to delete audio if exists
    const storyResult = await pool.query(
      'SELECT audio_url FROM stories WHERE story_id = $1',
      [storyId]
    );

    if (storyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }

    // Delete audio from S3 if exists
    if (storyResult.rows[0].audio_url) {
      try {
        const fileKey = storyResult.rows[0].audio_url.split('.com/')[1];
        await s3.deleteObject({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileKey
        }).promise();
      } catch (s3Error) {
        console.error('Error deleting audio from S3:', s3Error);
      }
    }

    await pool.query('DELETE FROM stories WHERE story_id = $1', [storyId]);

    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Error deleting story:', error);
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

module.exports = router;

