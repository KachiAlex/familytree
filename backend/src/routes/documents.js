const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');
const { checkResourceLimit, getFamilyUsageInfo } = require('../middleware/tierLimits');
const { uploadLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');
const AWS = require('aws-sdk');

const router = express.Router();
router.use(authenticateToken);

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload document
router.post('/upload', uploadLimiter, upload.single('file'), requireFamilyAccess, checkResourceLimit('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { person_id, family_id, document_type, title, description } = req.body;

    // Check storage limit
    const fileSizeMB = Math.ceil(req.file.size / (1024 * 1024));
    const limits = req.tierLimits;
    const usage = req.currentUsage;

    const { isWithinLimit } = require('../config/tiers');
    if (!isWithinLimit(usage.storage_mb + fileSizeMB, limits.max_storage_mb)) {
      return res.status(403).json({
        error: 'Storage limit exceeded',
        current: usage.storage_mb,
        limit: limits.max_storage_mb === -1 ? 'Unlimited' : limits.max_storage_mb,
        tier: req.familyTier,
        upgrade_required: true
      });
    }

    // Upload to S3
    const fileKey = `documents/${family_id}/${Date.now()}-${req.file.originalname}`;
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read'
    };

    const s3Result = await s3.upload(uploadParams).promise();

    // Save to database
    const result = await pool.query(
      `INSERT INTO documents (
        person_id, family_id, document_type, file_url, file_name,
        file_size, mime_type, title, description, uploaded_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        person_id || null,
        family_id,
        document_type || 'other',
        s3Result.Location,
        req.file.originalname,
        req.file.size,
        req.file.mimetype,
        title || req.file.originalname,
        description || null,
        req.user.user_id
      ]
    );

    res.status(201).json({
      message: 'Document uploaded successfully',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Get documents for a person
router.get('/person/:personId', async (req, res) => {
  try {
    const { personId } = req.params;

    const result = await pool.query(
      'SELECT * FROM documents WHERE person_id = $1 ORDER BY created_at DESC',
      [personId]
    );

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get documents for a family
router.get('/family/:familyId', requireFamilyAccess, async (req, res) => {
  try {
    const { familyId } = req.params;

    const result = await pool.query(
      'SELECT * FROM documents WHERE family_id = $1 ORDER BY created_at DESC',
      [familyId]
    );

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete document
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    // Get document info
    const docResult = await pool.query(
      'SELECT file_url FROM documents WHERE document_id = $1',
      [documentId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from S3
    const fileKey = docResult.rows[0].file_url.split('.com/')[1];
    await s3.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileKey
    }).promise();

    // Delete from database
    await pool.query(
      'DELETE FROM documents WHERE document_id = $1',
      [documentId]
    );

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;

