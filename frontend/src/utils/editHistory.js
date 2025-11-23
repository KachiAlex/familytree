/**
 * Edit History and Conflict Resolution Utilities
 */

import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';

/**
 * Create a pending edit change
 * @param {string} personId - Person ID
 * @param {string} familyId - Family ID
 * @param {string} userId - User ID making the change
 * @param {Object} oldValues - Current values
 * @param {Object} newValues - Proposed new values
 * @param {string} reason - Reason for the change (optional)
 * @returns {Promise<string>} Pending change ID
 */
export const createPendingChange = async (personId, familyId, userId, oldValues, newValues, reason = '') => {
  // Find what actually changed
  const changes = {};
  const changedFields = [];

  Object.keys(newValues).forEach((key) => {
    const oldVal = oldValues[key];
    const newVal = newValues[key];
    
    // Normalize values for comparison
    const normalizedOld = oldVal === null || oldVal === undefined || oldVal === '' ? null : String(oldVal).trim();
    const normalizedNew = newVal === null || newVal === undefined || newVal === '' ? null : String(newVal).trim();
    
    if (normalizedOld !== normalizedNew) {
      changes[key] = {
        old: oldVal,
        new: newVal,
      };
      changedFields.push(key);
    }
  });

  if (changedFields.length === 0) {
    throw new Error('No changes detected');
  }

  // Check for conflicts with other pending changes
  const conflicts = await checkForConflicts(personId, changedFields);

  const pendingChange = {
    person_id: personId,
    family_id: familyId,
    changed_by: userId,
    changes: changes,
    changed_fields: changedFields,
    reason: reason || null,
    status: 'pending',
    created_at: serverTimestamp(),
    conflicts_with: conflicts.length > 0 ? conflicts.map(c => c.pending_change_id) : [],
  };

  const docRef = await addDoc(collection(db, 'pendingChanges'), pendingChange);
  return docRef.id;
};

/**
 * Check for conflicts with existing pending changes
 * @param {string} personId - Person ID
 * @param {Array<string>} changedFields - Fields being changed
 * @returns {Promise<Array>} Array of conflicting pending changes
 */
export const checkForConflicts = async (personId, changedFields) => {
  try {
    const pendingChangesRef = collection(db, 'pendingChanges');
    const q = query(
      pendingChangesRef,
      where('person_id', '==', personId),
      where('status', '==', 'pending'),
      orderBy('created_at', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const conflicts = [];

    snapshot.docs.forEach((docSnap) => {
      const pendingChange = { pending_change_id: docSnap.id, ...docSnap.data() };
      const pendingFields = pendingChange.changed_fields || [];
      
      // Check if any fields overlap
      const hasConflict = changedFields.some((field) => pendingFields.includes(field));
      
      if (hasConflict) {
        conflicts.push(pendingChange);
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
 * @param {string} personId - Person ID
 * @returns {Promise<Array>} Array of pending changes
 */
export const getPendingChanges = async (personId) => {
  try {
    const pendingChangesRef = collection(db, 'pendingChanges');
    const q = query(
      pendingChangesRef,
      where('person_id', '==', personId),
      where('status', '==', 'pending'),
      orderBy('created_at', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      pending_change_id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error('Error fetching pending changes:', error);
    return [];
  }
};

/**
 * Get edit history for a person
 * @param {string} personId - Person ID
 * @param {number} limitCount - Maximum number of history items to return
 * @returns {Promise<Array>} Array of edit history items
 */
export const getEditHistory = async (personId, limitCount = 50) => {
  try {
    const editHistoryRef = collection(db, 'editHistory');
    const q = query(
      editHistoryRef,
      where('person_id', '==', personId),
      orderBy('created_at', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      history_id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error('Error fetching edit history:', error);
    return [];
  }
};

/**
 * Approve a pending change
 * @param {string} pendingChangeId - Pending change ID
 * @param {string} approvedBy - User ID approving the change
 * @param {string} approvalNotes - Optional approval notes
 * @returns {Promise<void>}
 */
export const approvePendingChange = async (pendingChangeId, approvedBy, approvalNotes = '') => {
  try {
    const pendingChangeRef = doc(db, 'pendingChanges', pendingChangeId);
    const pendingChangeSnap = await getDoc(pendingChangeRef);
    
    if (!pendingChangeSnap.exists()) {
      throw new Error('Pending change not found');
    }

    const pendingChange = { pending_change_id: pendingChangeId, ...pendingChangeSnap.data() };

    // Update person with approved changes
    const personRef = doc(db, 'persons', pendingChange.person_id);
    const updates = {};
    
    Object.keys(pendingChange.changes).forEach((field) => {
      updates[field] = pendingChange.changes[field].new;
    });
    
    updates.updated_at = serverTimestamp();
    updates.last_edited_by = approvedBy;
    updates.last_edited_at = serverTimestamp();

    await updateDoc(personRef, updates);

    // Record in edit history
    await addDoc(collection(db, 'editHistory'), {
      person_id: pendingChange.person_id,
      family_id: pendingChange.family_id,
      changed_by: pendingChange.changed_by,
      approved_by: approvedBy,
      changes: pendingChange.changes,
      reason: pendingChange.reason,
      approval_notes: approvalNotes || null,
      status: 'approved',
      created_at: serverTimestamp(),
      approved_at: serverTimestamp(),
    });

    // Mark pending change as approved
    await updateDoc(pendingChangeRef, {
      status: 'approved',
      approved_by: approvedBy,
      approved_at: serverTimestamp(),
      approval_notes: approvalNotes || null,
    });

    // Reject conflicting pending changes
    if (pendingChange.conflicts_with && pendingChange.conflicts_with.length > 0) {
      for (const conflictId of pendingChange.conflicts_with) {
        try {
          const conflictRef = doc(db, 'pendingChanges', conflictId);
          await updateDoc(conflictRef, {
            status: 'rejected',
            rejected_by: approvedBy,
            rejected_at: serverTimestamp(),
            rejection_reason: 'Conflicting change was approved',
          });
        } catch (error) {
          console.error('Error rejecting conflicting change:', error);
        }
      }
    }
  } catch (error) {
    console.error('Error approving pending change:', error);
    throw error;
  }
};

/**
 * Reject a pending change
 * @param {string} pendingChangeId - Pending change ID
 * @param {string} rejectedBy - User ID rejecting the change
 * @param {string} rejectionReason - Reason for rejection
 * @returns {Promise<void>}
 */
export const rejectPendingChange = async (pendingChangeId, rejectedBy, rejectionReason = '') => {
  try {
    const pendingChangeRef = doc(db, 'pendingChanges', pendingChangeId);
    await updateDoc(pendingChangeRef, {
      status: 'rejected',
      rejected_by: rejectedBy,
      rejected_at: serverTimestamp(),
      rejection_reason: rejectionReason || null,
    });
  } catch (error) {
    console.error('Error rejecting pending change:', error);
    throw error;
  }
};

/**
 * Get all pending changes for a family (for admins/elders)
 * @param {string} familyId - Family ID
 * @returns {Promise<Array>} Array of pending changes
 */
export const getFamilyPendingChanges = async (familyId) => {
  try {
    const pendingChangesRef = collection(db, 'pendingChanges');
    const q = query(
      pendingChangesRef,
      where('family_id', '==', familyId),
      where('status', '==', 'pending'),
      orderBy('created_at', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => ({
      pending_change_id: docSnap.id,
      ...docSnap.data(),
    }));
  } catch (error) {
    console.error('Error fetching family pending changes:', error);
    return [];
  }
};

