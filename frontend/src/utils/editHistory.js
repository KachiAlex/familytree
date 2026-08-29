/**
 * Edit History and Conflict Resolution Utilities
 * Uses backend API at /api/edit-history
 */

import api from '../services/api';

/**
 * Create a pending edit change
 */
export const createPendingChange = async (personId, familyId, userId, oldValues, newValues, reason = '') => {
  // Find what actually changed
  const changes = {};
  const changedFields = [];

  Object.keys(newValues).forEach((key) => {
    const oldVal = oldValues[key];
    const newVal = newValues[key];
    
    const normalizedOld = oldVal === null || oldVal === undefined || oldVal === '' ? null : String(oldVal).trim();
    const normalizedNew = newVal === null || newVal === undefined || newVal === '' ? null : String(newVal).trim();
    
    if (normalizedOld !== normalizedNew) {
      changes[key] = { old: oldVal, new: newVal };
      changedFields.push(key);
    }
  });

  if (changedFields.length === 0) {
    throw new Error('No changes detected');
  }

  const res = await api.post('/edit-history/pending', {
    person_id: parseInt(personId),
    family_id: parseInt(familyId),
    changes,
    changed_fields: changedFields,
    reason: reason || null,
  });

  return res.data.pendingChange?.pending_change_id || null;
};

/**
 * Check for conflicts with existing pending changes
 */
export const checkForConflicts = async (personId, changedFields) => {
  try {
    const res = await api.get(`/edit-history/pending/person/${personId}`);
    const pending = res.data.pendingChanges || [];
    const conflicts = [];

    pending.forEach((pc) => {
      const pendingFields = pc.changed_fields || [];
      const hasConflict = changedFields.some((field) => pendingFields.includes(field));
      if (hasConflict) {
        conflicts.push({
          pending_change_id: pc.pending_change_id,
          ...pc,
        });
      }
    });

    return conflicts;
  } catch (error) {
    console.error('Error checking for conflicts:', error);
    return [];
  }
};

/**
 * Get all pending changes for a person
 */
export const getPendingChanges = async (personId) => {
  try {
    const res = await api.get(`/edit-history/pending/person/${personId}`);
    return res.data.pendingChanges || [];
  } catch (error) {
    console.error('Error fetching pending changes:', error);
    return [];
  }
};

/**
 * Get edit history for a person
 */
export const getEditHistory = async (personId, limitCount = 50) => {
  try {
    const res = await api.get(`/edit-history/person/${personId}?limit=${limitCount}`);
    return (res.data.editHistory || []).map((h) => ({
      history_id: h.edit_history_id,
      ...h,
    }));
  } catch (error) {
    console.error('Error fetching edit history:', error);
    return [];
  }
};

/**
 * Approve a pending change
 */
export const approvePendingChange = async (pendingChangeId, approvedBy, approvalNotes = '') => {
  await api.post(`/edit-history/pending/${pendingChangeId}/approve`, {
    approval_notes: approvalNotes || null,
  });
};

/**
 * Reject a pending change
 */
export const rejectPendingChange = async (pendingChangeId, rejectedBy, rejectionReason = '') => {
  await api.post(`/edit-history/pending/${pendingChangeId}/reject`, {
    rejection_reason: rejectionReason || null,
  });
};

/**
 * Get all pending changes for a family (for admins/elders)
 */
export const getFamilyPendingChanges = async (familyId) => {
  try {
    const res = await api.get(`/edit-history/pending/family/${familyId}`);
    return res.data.pendingChanges || [];
  } catch (error) {
    console.error('Error fetching family pending changes:', error);
    return [];
  }
};
