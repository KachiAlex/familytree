import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
} from '@mui/material';
import {
  Face as FaceIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import api from '../services/api';

// Lazy-load MediaPipe face detection (CDN-served wasm + model). If the image
// is cross-origin without CORS headers, detection fails — the user can still
// tag faces manually by clicking on the photo.
const loadDetector = async () => {
  const vision = await import('@mediapipe/tasks-vision');
  const fileset = await vision.FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm'
  );
  return vision.FaceDetector.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
    },
    runningMode: 'IMAGE',
    minDetectionConfidence: 0.4,
  });
};

const FaceTagDialog = ({ doc, persons, open, onClose, onChanged }) => {
  const [faces, setFaces] = useState([]);
  const [selected, setSelected] = useState(null); // face_id
  const [assignTo, setAssignTo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const imgRef = useRef(null);
  const detectorRef = useRef(null);

  const fetchFaces = useCallback(async () => {
    if (!doc) return;
    setLoading(true);
    try {
      const res = await api.get(`/documents/${doc.document_id}/faces`);
      setFaces(res.data.faces || []);
    } catch (err) {
      setError('Could not load face tags.');
    } finally {
      setLoading(false);
    }
  }, [doc]);

  useEffect(() => {
    if (open && doc) {
      setFaces([]);
      setSelected(null);
      setAssignTo(null);
      setError('');
      fetchFaces();
    }
  }, [open, doc, fetchFaces]);

  const handleDetect = async () => {
    if (!imgRef.current) return;
    setDetecting(true);
    setError('');
    try {
      if (!detectorRef.current) {
        detectorRef.current = await loadDetector();
      }
      const img = imgRef.current;
      const result = detectorRef.current.detect(img);
      const found = (result.detections || []).map((d) => ({
        x: d.boundingBox.originX / img.naturalWidth,
        y: d.boundingBox.originY / img.naturalHeight,
        width: d.boundingBox.width / img.naturalWidth,
        height: d.boundingBox.height / img.naturalHeight,
      }));
      // Skip detections that overlap an already-tagged face
      const overlap = (a, b) =>
        !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y);
      const fresh = found.filter((f) => !faces.some((t) => overlap(f, t)));
      for (const f of fresh) {
        await api.post(`/documents/${doc.document_id}/faces`, { ...f });
      }
      if (fresh.length === 0) {
        setError(found.length === 0 ? 'No faces detected — click directly on a face to tag it.' : 'Detected faces are already tagged.');
      }
      await fetchFaces();
    } catch (err) {
      console.error('Face detection failed:', err);
      setError('Auto-detection unavailable for this photo — click directly on a face to tag it.');
    } finally {
      setDetecting(false);
    }
  };

  // Manual tagging: click on the photo to drop a face box there
  const handleImageClick = async (e) => {
    if (saving) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width;
    const cy = (e.clientY - rect.top) / rect.height;
    const size = 0.12;
    const box = {
      x: Math.max(0, Math.min(1 - size, cx - size / 2)),
      y: Math.max(0, Math.min(1 - size, cy - size / 2)),
      width: size,
      height: size,
    };
    try {
      await api.post(`/documents/${doc.document_id}/faces`, box);
      await fetchFaces();
    } catch (err) {
      setError('Failed to add tag.');
    }
  };

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/documents/faces/${selected}`, {
        person_id: assignTo ? assignTo.person_id : null,
      });
      await fetchFaces();
      setSelected(null);
      setAssignTo(null);
      if (onChanged) onChanged();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign tag.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.delete(`/documents/faces/${selected}`);
      await fetchFaces();
      setSelected(null);
      setAssignTo(null);
    } catch (err) {
      setError('Failed to remove tag.');
    } finally {
      setSaving(false);
    }
  };

  const selectedFace = faces.find((f) => f.face_id === selected);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FaceIcon color="primary" />
            <Typography variant="h6">Tag people — {doc?.title || 'Photo'}</Typography>
          </Box>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="info" sx={{ mb: 2 }}>{error}</Alert>}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
        ) : (
          <>
            <Box sx={{ position: 'relative', display: 'inline-block', maxWidth: '100%', cursor: 'crosshair' }}
              onClick={handleImageClick}>
              <img
                ref={imgRef}
                src={doc.file_url}
                crossOrigin="anonymous"
                alt={doc.title || 'Photo'}
                style={{ maxWidth: '100%', display: 'block', borderRadius: 8 }}
              />
              {faces.map((f) => (
                <Box
                  key={f.face_id}
                  onClick={(e) => { e.stopPropagation(); setSelected(f.face_id); setAssignTo(null); }}
                  sx={{
                    position: 'absolute',
                    left: `${f.x * 100}%`,
                    top: `${f.y * 100}%`,
                    width: `${f.width * 100}%`,
                    height: `${f.height * 100}%`,
                    border: `2px solid ${f.face_id === selected ? '#C25E10' : '#2e7d32'}`,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    bgcolor: f.face_id === selected ? 'rgba(194,94,16,0.15)' : 'rgba(46,125,50,0.08)',
                    '&:hover': { borderColor: '#C25E10' },
                  }}
                >
                  <Chip
                    size="small"
                    label={f.person_name || 'Tag me'}
                    sx={{
                      position: 'absolute', bottom: -26, left: -2, height: 20, fontSize: '11px',
                      bgcolor: f.person_name ? '#2e7d32' : '#9e9e9e', color: '#fff',
                    }}
                  />
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={detecting ? <CircularProgress size={16} /> : <FaceIcon />}
                onClick={handleDetect}
                disabled={detecting || saving}
              >
                {detecting ? 'Detecting…' : 'Detect Faces'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                or click directly on a face in the photo
              </Typography>
            </Box>

            {selectedFace && (
              <Box sx={{ display: 'flex', gap: 1, mt: 2.5, alignItems: 'center' }}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 1 }}
                  options={persons}
                  getOptionLabel={(p) => p.full_name || ''}
                  value={assignTo}
                  onChange={(e, v) => setAssignTo(v)}
                  renderInput={(params) => (
                    <TextField {...params} label={selectedFace.person_name ? `Currently: ${selectedFace.person_name}` : 'Assign to person'} />
                  )}
                />
                <Button variant="contained" onClick={handleAssign} disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={handleDelete} disabled={saving}>
                  Remove
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};

export default FaceTagDialog;
