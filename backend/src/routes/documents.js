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

// Get documents for a person — profile docs plus photos they're tagged in
router.get('/person/:personId', requireFamilyAccess, async (req, res) => {
  try {
    const { personId } = req.params;

    const result = await pool.query(
      `SELECT DISTINCT d.*, (d.person_id IS DISTINCT FROM $1) AS tagged_in_photo
       FROM documents d
       LEFT JOIN document_faces df ON df.document_id = d.document_id
       WHERE d.person_id = $1 OR df.person_id = $1
       ORDER BY d.created_at DESC`,
      [personId]
    );

    res.json({ documents: result.rows });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// List face tags on a document
router.get('/:documentId/faces', requireFamilyAccess, async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await pool.query(
      `SELECT df.*, p.full_name AS person_name
       FROM document_faces df
       LEFT JOIN persons p ON p.person_id = df.person_id
       WHERE df.document_id = $1`,
      [documentId]
    );

    res.json({ faces: result.rows });
  } catch (error) {
    console.error('Error fetching face tags:', error);
    res.status(500).json({ error: 'Failed to fetch face tags' });
  }
});

// Add a face tag to a document (person_id optional — unassigned detections allowed)
router.post('/:documentId/faces', requireFamilyAccess, async (req, res) => {
  try {
    const { documentId } = req.params;
    const { person_id, x, y, width, height } = req.body;

    const nums = [x, y, width, height].map(Number);
    if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 1) || width <= 0 || height <= 0) {
      return res.status(400).json({ error: 'x, y, width, height must be normalized fractions (0-1)' });
    }

    // If a person is assigned they must belong to the document's family
    if (person_id) {
      const check = await pool.query(
        `SELECT p.person_id FROM persons p
         JOIN documents d ON d.family_id = p.family_id
         WHERE d.document_id = $1 AND p.person_id = $2`,
        [documentId, person_id]
      );
      if (check.rows.length === 0) {
        return res.status(400).json({ error: 'Person is not in this document\'s family' });
      }
    }

    const result = await pool.query(
      `INSERT INTO document_faces (document_id, person_id, x, y, width, height, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [documentId, person_id || null, x, y, width, height, req.user.user_id]
    );

    res.status(201).json({ face: result.rows[0] });
  } catch (error) {
    console.error('Error adding face tag:', error);
    res.status(500).json({ error: 'Failed to add face tag' });
  }
});

// Update a face tag's person assignment
router.put('/faces/:faceId', async (req, res) => {
  try {
    const { faceId } = req.params;
    const { person_id } = req.body;

    const faceResult = await pool.query(
      `SELECT df.face_id, d.family_id FROM document_faces df
       JOIN documents d ON d.document_id = df.document_id
       WHERE df.face_id = $1`,
      [faceId]
    );
    if (faceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Face tag not found' });
    }
    const familyId = faceResult.rows[0].family_id;

    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [familyId, req.user.user_id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this family tree' });
    }

    if (person_id) {
      const personCheck = await pool.query(
        'SELECT person_id FROM persons WHERE person_id = $1 AND family_id = $2',
        [person_id, familyId]
      );
      if (personCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Person is not in this document\'s family' });
      }
    }

    const result = await pool.query(
      `UPDATE document_faces SET person_id = $1 WHERE face_id = $2 RETURNING *`,
      [person_id || null, faceId]
    );

    res.json({ face: result.rows[0] });
  } catch (error) {
    console.error('Error updating face tag:', error);
    res.status(500).json({ error: 'Failed to update face tag' });
  }
});

// Delete a face tag
router.delete('/faces/:faceId', async (req, res) => {
  try {
    const { faceId } = req.params;

    const faceResult = await pool.query(
      `SELECT df.face_id, d.family_id FROM document_faces df
       JOIN documents d ON d.document_id = df.document_id
       WHERE df.face_id = $1`,
      [faceId]
    );
    if (faceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Face tag not found' });
    }

    const memberCheck = await pool.query(
      'SELECT role FROM family_members WHERE family_id = $1 AND user_id = $2',
      [faceResult.rows[0].family_id, req.user.user_id]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this family tree' });
    }

    await pool.query('DELETE FROM document_faces WHERE face_id = $1', [faceId]);
    res.json({ message: 'Face tag removed' });
  } catch (error) {
    console.error('Error deleting face tag:', error);
    res.status(500).json({ error: 'Failed to delete face tag' });
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

