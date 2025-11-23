import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import { History as HistoryIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { getEditHistory } from '../utils/editHistory';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const EditHistoryDialog = ({ person, open, onClose }) => {
  const [editHistory, setEditHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState({});

  useEffect(() => {
    if (open && person) {
      fetchEditHistory();
    }
  }, [open, person]);

  const fetchEditHistory = async () => {
    if (!person) return;
    
    setLoading(true);
    try {
      const history = await getEditHistory(person.person_id, 50);
      setEditHistory(history);

      // Fetch user names
      const userIds = new Set([
        ...history.map((h) => h.changed_by),
        ...history.map((h) => h.approved_by).filter(Boolean),
      ]);
      const names = {};
      
      for (const userId of userIds) {
        try {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            names[userId] = userSnap.data().full_name || userSnap.data().email || userId;
          } else {
            names[userId] = userId;
          }
        } catch (error) {
          names[userId] = userId;
        }
      }
      
      setUserNames(names);
    } catch (error) {
      console.error('Failed to fetch edit history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFieldName = (field) => {
    const fieldNames = {
      full_name: 'Full Name',
      gender: 'Gender',
      date_of_birth: 'Date of Birth',
      date_of_death: 'Date of Death',
      place_of_birth: 'Place of Birth',
      place_of_death: 'Place of Death',
      occupation: 'Occupation',
      biography: 'Biography',
      clan_name: 'Clan Name',
      village_origin: 'Village Origin',
    };
    return fieldNames[field] || field;
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || value === '') {
      return <em style={{ color: '#999' }}>Empty</em>;
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(value).toLocaleDateString();
    }
    return String(value);
  };

  if (loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon color="primary" />
          <Typography variant="h6">Edit History for {person?.full_name}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {editHistory.length === 0 ? (
          <Alert severity="info">No edit history available for this person.</Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Changed By</TableCell>
                  <TableCell>Approved By</TableCell>
                  <TableCell>Fields Changed</TableCell>
                  <TableCell>Changes</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {editHistory.map((historyItem) => (
                  <TableRow key={historyItem.history_id}>
                    <TableCell>
                      {historyItem.created_at
                        ? new Date(historyItem.created_at.toDate()).toLocaleString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {userNames[historyItem.changed_by] || historyItem.changed_by}
                    </TableCell>
                    <TableCell>
                      {historyItem.approved_by
                        ? userNames[historyItem.approved_by] || historyItem.approved_by
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {Object.keys(historyItem.changes || {}).map((field) => (
                          <Chip
                            key={field}
                            label={formatFieldName(field)}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        {Object.entries(historyItem.changes || {}).slice(0, 2).map(([field, change]) => (
                          <Typography key={field} variant="caption" display="block">
                            <strong>{formatFieldName(field)}:</strong>{' '}
                            {formatValue(change.old)} → {formatValue(change.new)}
                          </Typography>
                        ))}
                        {Object.keys(historyItem.changes || {}).length > 2 && (
                          <Typography variant="caption" color="text.secondary">
                            +{Object.keys(historyItem.changes || {}).length - 2} more
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<CheckCircleIcon />}
                        label={historyItem.status || 'approved'}
                        size="small"
                        color="success"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditHistoryDialog;

