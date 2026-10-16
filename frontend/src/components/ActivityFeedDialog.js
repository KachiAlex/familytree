import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material';
import {
  PersonAdd as PersonAddIcon,
  Book as BookIcon,
  UploadFile as UploadFileIcon,
  Edit as EditIcon,
  PendingActions as PendingActionsIcon,
  Link as LinkIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import api from '../services/api';

const TYPE_META = {
  person_added: { icon: <PersonAddIcon fontSize="small" />, color: '#2e7d32' },
  story_added: { icon: <BookIcon fontSize="small" />, color: '#7b1fa2' },
  document_added: { icon: <UploadFileIcon fontSize="small" />, color: '#1565c0' },
  profile_updated: { icon: <EditIcon fontSize="small" />, color: '#C25E10' },
  change_proposed: { icon: <PendingActionsIcon fontSize="small" />, color: '#ef6c00' },
  relationship_added: { icon: <LinkIcon fontSize="small" />, color: '#00838f' },
};

const REL_LABELS = {
  parent: 'parent of',
  spouse: 'spouse of',
  sibling: 'sibling of',
  cousin: 'cousin of',
  uncle_aunt: 'uncle/aunt of',
  in_law: 'in-law of',
};

const describeItem = (item) => {
  const actor = item.actor || 'Someone';
  switch (item.type) {
    case 'person_added':
      return `${actor} added ${item.subject} to the family tree`;
    case 'story_added':
      return `${actor} recorded the story "${item.subject}"${item.detail ? ` about ${item.detail}` : ''}`;
    case 'document_added':
      return `${actor} uploaded "${item.subject}"${item.detail ? ` for ${item.detail}` : ''}`;
    case 'profile_updated':
      return `${actor} updated ${item.subject}'s profile${item.detail ? ` (${item.detail})` : ''}`;
    case 'change_proposed':
      return `${actor} proposed a ${item.detail || 'profile'} change for ${item.subject}`;
    case 'relationship_added': {
      const [rel, other] = (item.detail || '|').split('|');
      return `${item.subject} was linked as ${REL_LABELS[rel] || rel} ${other}`;
    }
    default:
      return `${actor} — ${item.subject || ''}`;
  }
};

const ActivityFeedDialog = ({ familyId, open, onClose }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !familyId) return;
    const fetchActivity = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/families/${familyId}/activity?limit=100`);
        setItems(res.data.activity || []);
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [open, familyId]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { maxHeight: '80vh' } }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6">Family Activity</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : items.length === 0 ? (
          <Typography color="text.secondary">No recent activity in this family yet.</Typography>
        ) : (
          items.map((item, i) => {
            const meta = TYPE_META[item.type] || TYPE_META.profile_updated;
            return (
              <React.Fragment key={i}>
                <Box sx={{ display: 'flex', gap: 1.5, py: 1.25, alignItems: 'flex-start' }}>
                  <Box sx={{ color: meta.color, mt: 0.25 }}>{meta.icon}</Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2">{describeItem(item)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.at ? new Date(item.at).toLocaleString() : ''}
                    </Typography>
                  </Box>
                  {item.type === 'change_proposed' && (
                    <Chip label="pending" size="small" color="warning" variant="outlined" />
                  )}
                </Box>
                {i < items.length - 1 && <Divider />}
              </React.Fragment>
            );
          })
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ActivityFeedDialog;
