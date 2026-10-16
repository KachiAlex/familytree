const express = require('express');
const { pool } = require('../db/connection');
const { authenticateToken, requireFamilyAccess } = require('../middleware/auth');
const { checkResourceLimit, getFamilyUsageInfo } = require('../middleware/tierLimits');
const { uploadLimiter } = require('../middleware/rateLimiter');
const multer = require('multer');
const { uploadToR2, deleteFromR2 } = require('../utils/s3');
const { notifyProfileOwnerOfPendingChange } = require('../utils/pendingNotify');

const router = express.Router();
router.use(authenticateToken);

// Configure multer for file uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'application/pdf',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`), false);
    }
  }
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

    // Upload to R2
    const fileKey = `documents/${family_id}/${Date.now()}-${req.file.originalname}`;
    const s3Result = await uploadToR2(req.file, fileKey);

    // Documents attached to a claimed profile are published only after the
    // profile's owning account confirms them.
    if (person_id) {
      const ownerResult = await pool.query(
        'SELECT owner_user_id, full_name FROM persons WHERE person_id = $1',
        [person_id]
      );
      const owner = ownerResult.rows[0];
      if (owner && owner.owner_user_id && owner.owner_user_id !== req.user.user_id) {
        const pendingResult = await pool.query(
          `INSERT INTO pending_changes (person_id, family_id, changed_by_user_id, changes, changed_fields, reason, change_type, payload)
           VALUES ($1, $2, $3, $4, $5, $6, 'document', $7)
           RETURNING *`,
          [person_id, family_id, req.user.user_id,
           JSON.stringify({ document: { old: null, new: title || req.file.originalname } }),
           ['document'], description || null,
           JSON.stringify({
             document_type: document_type || 'other',
             file_url: s3Result.Location,
             file_key: fileKey,
             file_name: req.file.originalname,
             file_size: req.file.size,
             mime_type: req.file.mimetype,
             title: title || req.file.originalname,
             description: description || null
           })]
        );

        await notifyProfileOwnerOfPendingChange({
          ownerUserId: owner.owner_user_id,
          personId: person_id,
          personName: owner.full_name,
          changerName: req.user.full_name || req.user.email,
          summary: `Proposed a document: ${title || req.file.originalname}`,
        });

        return res.status(202).json({
          pending: true,
          message: `This profile is managed by its account owner. The document was submitted for their confirmation.`,
          pendingChange: pendingResult.rows[0]
        });
      }
    }

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
router.get('/person/:personId', requireFamilyAccess, async (req, res) => {
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
router.delete('/:documentId', requireFamilyAccess, async (req, res) => {
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

    // Delete from R2
    const fileKey = docResult.rows[0].file_url.split('.com/')[1] || docResult.rows[0].file_url.split('.dev/')[1] || docResult.rows[0].file_url.split('/').pop();
    await deleteFromR2(fileKey);

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

