import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { getPendingChanges, approvePendingChange, rejectPendingChange } from '../utils/editHistory';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const PendingChangesDialog = ({ person, open, onClose, currentUser, onChangesResolved }) => {
  const [pendingChanges, setPendingChanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedChange, setSelectedChange] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [userNames, setUserNames] = useState({});

  useEffect(() => {
    if (open && person) {
      fetchPendingChanges();
    }
  }, [open, person]);

  const fetchPendingChanges = async () => {
    if (!person) return;
    
    setLoading(true);
    try {
      const changes = await getPendingChanges(person.person_id);
      setPendingChanges(changes);

      // Fetch user names for display
      const userIds = new Set(changes.map((c) => c.changed_by));
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
      console.error('Failed to fetch pending changes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (change) => {
    if (!currentUser) return;
    
    setProcessing(true);
    try {
      await approvePendingChange(change.pending_change_id, currentUser.uid, approvalNotes);
      setApprovalNotes('');
      setSelectedChange(null);
      await fetchPendingChanges();
      
      if (onChangesResolved) {
        onChangesResolved();
      }
    } catch (error) {
      console.error('Failed to approve change:', error);
      alert('Failed to approve change. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (change) => {
    if (!currentUser) return;
    
    setProcessing(true);
    try {
      await rejectPendingChange(change.pending_change_id, currentUser.uid, rejectionReason);
      setRejectionReason('');
      setSelectedChange(null);
      await fetchPendingChanges();
      
      if (onChangesResolved) {
        onChangesResolved();
      }
    } catch (error) {
      console.error('Failed to reject change:', error);
      alert('Failed to reject change. Please try again.');
    } finally {
      setProcessing(false);
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
          <Typography variant="h6">Pending Changes for {person?.full_name}</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {pendingChanges.length === 0 ? (
          <Alert severity="info">No pending changes for this person.</Alert>
        ) : (
          <>
            {selectedChange ? (
              // Show details of selected change
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    Change Details
                  </Typography>
                  <Button size="small" onClick={() => setSelectedChange(null)}>
                    Back to List
                  </Button>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Proposed by: <strong>{userNames[selectedChange.changed_by] || selectedChange.changed_by}</strong>
                  </Typography>
                  {selectedChange.reason && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Reason: {selectedChange.reason}
                    </Typography>
                  )}
                  {selectedChange.conflicts_with && selectedChange.conflicts_with.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      This change conflicts with {selectedChange.conflicts_with.length} other pending change(s).
                    </Alert>
                  )}
                </Box>

                <Divider sx={{ my: 2 }} />

                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Field</TableCell>
                        <TableCell>Current Value</TableCell>
                        <TableCell>Proposed Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(selectedChange.changes || {}).map(([field, change]) => (
                        <TableRow key={field}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {formatFieldName(field)}
                            </Typography>
                          </TableCell>
                          <TableCell>{formatValue(change.old)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" color="primary" fontWeight="medium">
                              {formatValue(change.new)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 3 }}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Approval Notes (Optional)"
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="Add notes about why you're approving this change..."
                    sx={{ mb: 2 }}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Rejection Reason (Optional)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why you're rejecting this change..."
                    sx={{ mb: 2 }}
                  />
                </Box>
              </Box>
            ) : (
              // Show list of pending changes
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Changed By</TableCell>
                      <TableCell>Fields Changed</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell>Conflicts</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingChanges.map((change) => (
                      <TableRow key={change.pending_change_id} hover>
                        <TableCell>
                          {userNames[change.changed_by] || change.changed_by}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            {(change.changed_fields || []).map((field) => (
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
                          {change.reason ? (
                            <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                              {change.reason}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary" fontStyle="italic">
                              No reason provided
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {change.conflicts_with && change.conflicts_with.length > 0 ? (
                            <Tooltip title={`Conflicts with ${change.conflicts_with.length} other change(s)`}>
                              <Chip
                                icon={<WarningIcon />}
                                label={change.conflicts_with.length}
                                size="small"
                                color="warning"
                              />
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {change.created_at
                            ? new Date(change.created_at.toDate()).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setSelectedChange(change)}
                            >
                              View
                            </Button>
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => handleApprove(change)}
                              disabled={processing}
                            >
                              Approve
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => handleReject(change)}
                              disabled={processing}
                            >
                              Reject
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        {selectedChange && (
          <Box sx={{ display: 'flex', gap: 1, flex: 1 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => handleApprove(selectedChange)}
              disabled={processing}
            >
              Approve Change
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => handleReject(selectedChange)}
              disabled={processing}
            >
              Reject Change
            </Button>
          </Box>
        )}
        <Button onClick={onClose} disabled={processing}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PendingChangesDialog;

