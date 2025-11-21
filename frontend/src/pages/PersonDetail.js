import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Autocomplete,
  Snackbar,
  Alert,
  Avatar,
  CircularProgress,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Delete as DeleteIcon, Warning as WarningIcon, Email as EmailIcon, CheckCircle as CheckCircleIcon, PhotoCamera as PhotoCameraIcon, Upload as UploadIcon, Close as CloseIcon, Book as BookIcon, VolumeUp as VolumeUpIcon, Edit as EditIcon, PictureAsPdf as PdfIcon } from '@mui/icons-material';
import { db, storage } from '../firebase';
import { exportPersonProfileToPDF } from '../utils/pdfExport';
import { compressImage } from '../utils/imageCompression';
import { useAuth } from '../contexts/AuthContext';
import { PersonDetailSkeleton } from '../components/SkeletonLoaders';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';

const PersonDetail = () => {
  const { personId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [person, setPerson] = useState(null);
  const [family, setFamily] = useState(null);
  const [parents, setParents] = useState([]);
  const [children, setChildren] = useState([]);
  const [siblings, setSiblings] = useState([]);
  const [spouses, setSpouses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allFamilyPersons, setAllFamilyPersons] = useState([]);
  const [addFamilyOpen, setAddFamilyOpen] = useState(false);
  const [familyRelType, setFamilyRelType] = useState('parent'); // 'parent' | 'child' | 'spouse'
  const [selectedFamilyPersonId, setSelectedFamilyPersonId] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('married'); // 'married' | 'divorced' | 'widowed' | 'separated'
  const [selfRelation, setSelfRelation] = useState(null);
  const [relationSaving, setRelationSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editValues, setEditValues] = useState(null);
  const [editMaritalStatusOpen, setEditMaritalStatusOpen] = useState(false);
  const [editingSpouseRel, setEditingSpouseRel] = useState(null);
  const [editingMaritalStatus, setEditingMaritalStatus] = useState('married');
  const [addNewPersonOpen, setAddNewPersonOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState('photo');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [storyDialogOpen, setStoryDialogOpen] = useState(false);
  const [editingStoryId, setEditingStoryId] = useState(null);
  const [storyTitle, setStoryTitle] = useState('');
  const [storyContent, setStoryContent] = useState('');
  const [storyNarrator, setStoryNarrator] = useState('');
  const [storyDate, setStoryDate] = useState('');
  const [storyLocation, setStoryLocation] = useState('');
  const [storyAudioFile, setStoryAudioFile] = useState(null);
  const [storyTags, setStoryTags] = useState('');
  const [savingStory, setSavingStory] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [uploadingProfilePicture, setUploadingProfilePicture] = useState(false);
  const [commonValues, setCommonValues] = useState({
    clan_names: [],
    village_origins: [],
    places_of_birth: [],
    occupations: [],
  });
  const [newPersonValues, setNewPersonValues] = useState({
    full_name: '',
    gender: '',
    date_of_birth: '',
    place_of_birth: '',
    occupation: '',
    biography: '',
    clan_name: '',
    village_origin: '',
  });

  useEffect(() => {
    fetchPersonDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  // Fetch common values from existing family members
  useEffect(() => {
    const fetchCommonValues = async () => {
      if (!person?.family_id) return;
      try {
        const personsRef = collection(db, 'persons');
        const personsQuery = query(personsRef, where('family_id', '==', person.family_id));
        const snap = await getDocs(personsQuery);
        
        const clans = new Set();
        const villages = new Set();
        const places = new Set();
        const occupations = new Set();

        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (data.clan_name) clans.add(data.clan_name);
          if (data.village_origin) villages.add(data.village_origin);
          if (data.place_of_birth) places.add(data.place_of_birth);
          if (data.occupation) occupations.add(data.occupation);
        });

        setCommonValues({
          clan_names: Array.from(clans).sort(),
          village_origins: Array.from(villages).sort(),
          places_of_birth: Array.from(places).sort(),
          occupations: Array.from(occupations).sort(),
        });
      } catch (err) {
        console.error('Failed to fetch common values:', err);
      }
    };

    if (person?.family_id) {
      fetchCommonValues();
    }
  }, [person?.family_id]);

  const fetchPersonDetails = async () => {
    try {
      const personRef = doc(db, 'persons', personId);
      const snap = await getDoc(personRef);
      if (!snap.exists()) {
        setPerson(null);
        setFamily(null);
      } else {
        const personData = { person_id: snap.id, ...snap.data() };
        setPerson(personData);
        await Promise.all([
          fetchFamily(personData.family_id),
          fetchFamilyPersons(personData.family_id, personData.person_id),
          fetchRelationships(personData),
          fetchDocuments(personData.person_id, personData.family_id),
          fetchStories(personData.person_id, personData.family_id),
        ]);
        if (user) {
          await fetchUserRelation(personData, user);
        }
      }
    } catch (error) {
      console.error('Failed to fetch person details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilyPersons = async (familyId, currentPersonId) => {
    if (!familyId) return;
    try {
      const personsRef = collection(db, 'persons');
      const personsQuery = query(personsRef, where('family_id', '==', familyId));
      const snap = await getDocs(personsQuery);
      const list = snap.docs
        .filter((d) => d && d.id && d.id !== currentPersonId)
        .map((d) => ({
          person_id: d.id,
          ...d.data(),
        }))
        .filter((p) => p && p.person_id); // Filter out any invalid entries
      setAllFamilyPersons(list);
    } catch (error) {
      console.error('Failed to fetch family persons:', error);
      setAllFamilyPersons([]);
    }
  };

  const fetchDocuments = async (personId, familyId) => {
    try {
      const documentsRef = collection(db, 'documents');
      const documentsQuery = query(
        documentsRef,
        where('family_id', '==', familyId),
        where('person_id', '==', personId),
      );
      const snap = await getDocs(documentsQuery);
      const docs = snap.docs.map((docSnap) => ({
        document_id: docSnap.id,
        ...docSnap.data(),
      }));
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([]);
    }
  };

  const fetchStories = async (personId, familyId) => {
    try {
      const storiesRef = collection(db, 'stories');
      const storiesQuery = query(
        storiesRef,
        where('family_id', '==', familyId),
        where('person_id', '==', personId),
      );
      const snap = await getDocs(storiesQuery);
      const storiesList = snap.docs.map((docSnap) => ({
        story_id: docSnap.id,
        ...docSnap.data(),
      }));
      // Sort by date (newest first)
      storiesList.sort((a, b) => {
        const dateA = a.recorded_date ? new Date(a.recorded_date) : new Date(a.created_at?.toDate() || 0);
        const dateB = b.recorded_date ? new Date(b.recorded_date) : new Date(b.created_at?.toDate() || 0);
        return dateB - dateA;
      });
      setStories(storiesList);
    } catch (error) {
      console.error('Failed to fetch stories:', error);
      setStories([]);
    }
  };

  const fetchRelationships = async (personData) => {
    const familyId = personData.family_id;
    if (!familyId) return;

    try {
      const relRef = collection(db, 'relationships');

      // Parents: relationships where this person is the child
      const parentsQuery = query(
        relRef,
        where('family_id', '==', familyId),
        where('child_id', '==', personData.person_id),
      );
      const parentsSnap = await getDocs(parentsQuery);

      const parentPersons = [];
      for (const relDoc of parentsSnap.docs) {
        const rel = relDoc.data();
        if (!rel || !rel.parent_id) continue; // Skip invalid relationships
        const parentRef = doc(db, 'persons', rel.parent_id);
        const parentSnap = await getDoc(parentRef);
        if (parentSnap.exists()) {
          parentPersons.push({
            person_id: parentSnap.id,
            relationship_id: relDoc.id, // Store relationship ID for deletion
            ...parentSnap.data(),
          });
        }
      }
      setParents(parentPersons.filter(p => p && p.person_id));

      // Siblings: other children who share any parent with this person
      const siblingMap = new Map();
      for (const parent of parentPersons) {
        if (!parent || !parent.person_id) continue; // Skip invalid parents
        const siblingsQuery = query(
          relRef,
          where('family_id', '==', familyId),
          where('parent_id', '==', parent.person_id),
        );
        const siblingsSnap = await getDocs(siblingsQuery);
        for (const sDoc of siblingsSnap.docs) {
          const sRel = sDoc.data();
          if (!sRel || !sRel.child_id || sRel.child_id === personData.person_id) continue;
          if (!siblingMap.has(sRel.child_id)) {
            const sibRef = doc(db, 'persons', sRel.child_id);
            const sibSnap = await getDoc(sibRef);
            if (sibSnap.exists()) {
              siblingMap.set(sRel.child_id, {
                person_id: sibSnap.id,
                ...sibSnap.data(),
              });
            }
          }
        }
      }
      setSiblings(Array.from(siblingMap.values()).filter(s => s && s.person_id));

      // Children: relationships where this person is the parent
      const childrenQuery = query(
        relRef,
        where('family_id', '==', familyId),
        where('parent_id', '==', personData.person_id),
      );
      const childrenSnap = await getDocs(childrenQuery);

      const childPersons = [];
      for (const relDoc of childrenSnap.docs) {
        const rel = relDoc.data();
        if (!rel || !rel.child_id) continue; // Skip invalid relationships
        const childRef = doc(db, 'persons', rel.child_id);
        const childSnap = await getDoc(childRef);
        if (childSnap.exists()) {
          childPersons.push({
            person_id: childSnap.id,
            relationship_id: relDoc.id, // Store relationship ID for deletion
            ...childSnap.data(),
          });
        }
      }
      setChildren(childPersons.filter(c => c && c.person_id));

      // Spouses: relationships where this person is spouse1 or spouse2
      const spouseRelRef = collection(db, 'spouseRelationships');
      const spouseQuery1 = query(
        spouseRelRef,
        where('family_id', '==', familyId),
        where('spouse1_id', '==', personData.person_id),
      );
      const spouseQuery2 = query(
        spouseRelRef,
        where('family_id', '==', familyId),
        where('spouse2_id', '==', personData.person_id),
      );
      const [spouseSnap1, spouseSnap2] = await Promise.all([
        getDocs(spouseQuery1),
        getDocs(spouseQuery2),
      ]);

      const spousePersons = [];
      for (const relDoc of spouseSnap1.docs) {
        const rel = relDoc.data();
        if (!rel || !rel.spouse2_id) continue; // Skip invalid relationships
        const spousePersonRef = doc(db, 'persons', rel.spouse2_id);
        const spousePersonSnap = await getDoc(spousePersonRef);
        if (spousePersonSnap.exists()) {
          spousePersons.push({
            person_id: spousePersonSnap.id,
            relationship_id: relDoc.id, // Store relationship ID for deletion
            marital_status: rel.marital_status || 'married', // Include marital status
            ...spousePersonSnap.data(),
          });
        }
      }
      for (const relDoc of spouseSnap2.docs) {
        const rel = relDoc.data();
        if (!rel || !rel.spouse1_id) continue; // Skip invalid relationships
        const spousePersonRef = doc(db, 'persons', rel.spouse1_id);
        const spousePersonSnap = await getDoc(spousePersonRef);
        if (spousePersonSnap.exists()) {
          spousePersons.push({
            person_id: spousePersonSnap.id,
            relationship_id: relDoc.id, // Store relationship ID for deletion
            marital_status: rel.marital_status || 'married', // Include marital status
            ...spousePersonSnap.data(),
          });
        }
      }
      setSpouses(spousePersons.filter(s => s && s.person_id));
    } catch (error) {
      console.error('Failed to fetch relationships:', error);
      setParents([]);
      setChildren([]);
      setSpouses([]);
    }
  };

  const fetchFamily = async (familyId) => {
    if (!familyId) return;
    try {
      const familyRef = doc(db, 'families', familyId);
      const snap = await getDoc(familyRef);
      if (snap.exists()) {
        setFamily({ family_id: snap.id, ...snap.data() });
      } else {
        setFamily(null);
      }
    } catch (error) {
      console.error('Failed to fetch family:', error);
      setFamily(null);
    }
  };

  const fetchUserRelation = async (personData, currentUser) => {
    try {
      if (!currentUser) return;
      const relRef = collection(db, 'userRelationships');
      const relQuery = query(
        relRef,
        where('family_id', '==', personData.family_id),
        where('user_id', '==', currentUser.user_id),
        where('person_id', '==', personData.person_id),
      );
      const relSnap = await getDocs(relQuery);
      if (!relSnap.empty) {
        const docSnap = relSnap.docs[0];
        setSelfRelation({ id: docSnap.id, ...docSnap.data() });
      } else {
        setSelfRelation(null);
      }
    } catch (error) {
      console.error('Failed to fetch user relationship:', error);
      setSelfRelation(null);
    }
  };

  useEffect(() => {
    if (person && user) {
      fetchUserRelation(person, user);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, user]);

  const canEdit =
    user &&
    person &&
    ((person.ownerUserId && person.ownerUserId === user.user_id) ||
      (family && family.created_by_user_id === user.user_id));

  const openEdit = () => {
    if (!person) return;
    setEditValues({
      full_name: person.full_name || '',
      gender: person.gender || '',
      date_of_birth: person.date_of_birth || '',
      date_of_death: person.date_of_death || '',
      place_of_birth: person.place_of_birth || '',
      occupation: person.occupation || '',
      biography: person.biography || '',
      clan_name: person.clan_name || '',
      village_origin: person.village_origin || '',
    });
    setEditOpen(true);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveEdit = async () => {
    if (!person || !editValues) return;
    try {
      const updates = {
        full_name: editValues.full_name,
        gender: editValues.gender,
        date_of_birth: editValues.date_of_birth || null,
        date_of_death: editValues.date_of_death || null,
        place_of_birth: editValues.place_of_birth || null,
        occupation: editValues.occupation || null,
        biography: editValues.biography || null,
        clan_name: editValues.clan_name || null,
        village_origin: editValues.village_origin || null,
        updated_at: serverTimestamp(),
      };
      const personRef = doc(db, 'persons', person.person_id);
      await updateDoc(personRef, updates);
      setPerson((prev) => (prev ? { ...prev, ...updates } : prev));
      setEditOpen(false);
      setSnackbar({ open: true, message: 'Person details updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to update person:', error);
      setSnackbar({ open: true, message: 'Failed to save changes. Please try again.', severity: 'error' });
    }
  };

  const handleRelationChange = async (event) => {
    if (!person || !user) return;
    const value = event.target.value;
    setRelationSaving(true);
    try {
      const relRef = collection(db, 'userRelationships');
      if (selfRelation) {
        await updateDoc(doc(relRef, selfRelation.id), {
          relationship_to_self: value,
          updated_at: serverTimestamp(),
        });
        setSelfRelation((prev) => (prev ? { ...prev, relationship_to_self: value } : prev));
      } else {
        const newDoc = await addDoc(relRef, {
          family_id: person.family_id,
          user_id: user.user_id,
          person_id: person.person_id,
          relationship_to_self: value,
          created_at: serverTimestamp(),
        });
        setSelfRelation({ id: newDoc.id, relationship_to_self: value });
      }
      setSnackbar({ open: true, message: 'Relationship updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to update relationship to you:', error);
      setSnackbar({ open: true, message: 'Failed to update your relationship to this person.', severity: 'error' });
    } finally {
      setRelationSaving(false);
    }
  };

  const handleNewPersonChange = (e) => {
    const { name, value } = e.target;
    setNewPersonValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCreateNewPerson = async () => {
    if (!person || !newPersonValues.full_name.trim()) {
      setSnackbar({ open: true, message: 'Please provide at least a full name.', severity: 'warning' });
      return;
    }
    try {
      const personsRef = collection(db, 'persons');
      const newPersonDoc = await addDoc(personsRef, {
        family_id: person.family_id,
        full_name: newPersonValues.full_name.trim(),
        gender: newPersonValues.gender || null,
        date_of_birth: newPersonValues.date_of_birth || null,
        place_of_birth: newPersonValues.place_of_birth || null,
        occupation: newPersonValues.occupation || null,
        biography: newPersonValues.biography || null,
        clan_name: newPersonValues.clan_name || null,
        village_origin: newPersonValues.village_origin || null,
        alive_status: true,
        verified_by_elder: false,
        created_at: serverTimestamp(),
      });

      // Now create the relationship based on the selected type
      await handleAddFamilyRelationship(newPersonDoc.id);
      
      // Refresh data
      await fetchFamilyPersons(person.family_id, person.person_id);
      await fetchRelationships(person);
      
      // Reset form
      setNewPersonValues({
        full_name: '',
        gender: '',
        date_of_birth: '',
        place_of_birth: '',
        occupation: '',
        biography: '',
        clan_name: '',
        village_origin: '',
      });
      setAddNewPersonOpen(false);
      setAddFamilyOpen(false);
      setSnackbar({ open: true, message: 'New family member added and linked successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to create new person:', error);
      setSnackbar({ open: true, message: 'Failed to create new family member. Please try again.', severity: 'error' });
    }
  };

  const handleAddFamilyRelationship = async (targetPersonId) => {
    if (!person || !targetPersonId) return;
    try {
      if (familyRelType === 'spouse') {
        // Create spouse relationship
        const spouseRef = collection(db, 'spouseRelationships');
        await addDoc(spouseRef, {
          family_id: person.family_id,
          spouse1_id: person.person_id,
          spouse2_id: targetPersonId,
          marital_status: maritalStatus || 'married',
          created_at: serverTimestamp(),
        });
      } else {
        // Create parent-child relationship
        const relRef = collection(db, 'relationships');
        const parentId = familyRelType === 'parent' ? targetPersonId : person.person_id;
        const childId = familyRelType === 'parent' ? person.person_id : targetPersonId;
        await addDoc(relRef, {
          family_id: person.family_id,
          parent_id: parentId,
          child_id: childId,
          created_at: serverTimestamp(),
        });
      }
      await fetchRelationships(person);
    } catch (error) {
      console.error('Failed to add family relationship:', error);
      throw error;
    }
  };

  const handleDeleteRelationship = async (relationshipId, relationshipType) => {
    if (!person || !relationshipId) return;
    
    if (!window.confirm('Are you sure you want to remove this family relationship?')) {
      return;
    }

    try {
      if (relationshipType === 'spouse') {
        // Delete spouse relationship
        const spouseRef = doc(db, 'spouseRelationships', relationshipId);
        await deleteDoc(spouseRef);
      } else {
        // Delete parent-child relationship
        const relRef = doc(db, 'relationships', relationshipId);
        await deleteDoc(relRef);
      }
      
      // Refresh relationships
      await fetchRelationships(person);
      setSnackbar({ open: true, message: 'Family relationship removed successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to delete relationship:', error);
      setSnackbar({ open: true, message: 'Failed to remove relationship. Please try again.', severity: 'error' });
    }
  };

  const handleEditMaritalStatus = (spouse) => {
    setEditingSpouseRel(spouse);
    setEditingMaritalStatus(spouse.marital_status || 'married');
    setEditMaritalStatusOpen(true);
  };

  const handleSaveMaritalStatus = async () => {
    if (!editingSpouseRel || !editingSpouseRel.relationship_id) return;
    
    try {
      const spouseRef = doc(db, 'spouseRelationships', editingSpouseRel.relationship_id);
      await updateDoc(spouseRef, {
        marital_status: editingMaritalStatus,
      });
      
      await fetchRelationships(person);
      setEditMaritalStatusOpen(false);
      setEditingSpouseRel(null);
      setSnackbar({ open: true, message: 'Marital status updated successfully', severity: 'success' });
    } catch (error) {
      console.error('Failed to update marital status:', error);
      setSnackbar({ open: true, message: 'Failed to update marital status. Please try again.', severity: 'error' });
    }
  };

  const handleDeletePerson = async () => {
    if (!person || !canEdit) return;

    setDeleting(true);
    try {
      // Delete all relationships where this person is involved
      const relRef = collection(db, 'relationships');
      
      // Delete relationships where person is parent
      try {
        const parentRelsQuery = query(
          relRef,
          where('family_id', '==', person.family_id),
          where('parent_id', '==', person.person_id)
        );
        const parentRelsSnap = await getDocs(parentRelsQuery);
        for (const relDoc of parentRelsSnap.docs) {
          await deleteDoc(doc(db, 'relationships', relDoc.id));
        }
      } catch (err) {
        console.error('Error deleting parent relationships:', err);
      }

      // Delete relationships where person is child
      try {
        const childRelsQuery = query(
          relRef,
          where('family_id', '==', person.family_id),
          where('child_id', '==', person.person_id)
        );
        const childRelsSnap = await getDocs(childRelsQuery);
        for (const relDoc of childRelsSnap.docs) {
          await deleteDoc(doc(db, 'relationships', relDoc.id));
        }
      } catch (err) {
        console.error('Error deleting child relationships:', err);
      }

      // Delete spouse relationships
      try {
        const spouseRef = collection(db, 'spouseRelationships');
        const spouseQuery1 = query(
          spouseRef,
          where('family_id', '==', person.family_id),
          where('spouse1_id', '==', person.person_id)
        );
        const spouseQuery2 = query(
          spouseRef,
          where('family_id', '==', person.family_id),
          where('spouse2_id', '==', person.person_id)
        );
        const [spouseSnap1, spouseSnap2] = await Promise.all([
          getDocs(spouseQuery1),
          getDocs(spouseQuery2),
        ]);
        for (const relDoc of spouseSnap1.docs) {
          await deleteDoc(doc(db, 'spouseRelationships', relDoc.id));
        }
        for (const relDoc of spouseSnap2.docs) {
          await deleteDoc(doc(db, 'spouseRelationships', relDoc.id));
        }
      } catch (err) {
        console.error('Error deleting spouse relationships:', err);
      }

      // Delete user relationships
      try {
        const userRelRef = collection(db, 'userRelationships');
        const userRelsQuery = query(
          userRelRef,
          where('family_id', '==', person.family_id),
          where('person_id', '==', person.person_id)
        );
        const userRelsSnap = await getDocs(userRelsQuery);
        for (const relDoc of userRelsSnap.docs) {
          await deleteDoc(doc(db, 'userRelationships', relDoc.id));
        }
      } catch (err) {
        console.error('Error deleting user relationships:', err);
      }

      // Finally, delete the person document
      const personRef = doc(db, 'persons', person.person_id);
      await deleteDoc(personRef);

      // Redirect to family tree
      navigate(`/family/${person.family_id}/tree`);
    } catch (error) {
      console.error('Failed to delete person:', error);
      setSnackbar({ open: true, message: `Failed to delete family member: ${error.message}. Please make sure you have permission to delete this person.`, severity: 'error' });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <PersonDetailSkeleton />
      </Container>
    );
  }

  if (!person) {
    return <Typography>Person not found</Typography>;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <Box sx={{ position: 'relative', width: '100%', height: 300, bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {person.profile_photo_url ? (
                <CardMedia
                  component="img"
                  height="300"
                  image={person.profile_photo_url}
                  alt={person.full_name}
                  sx={{ objectFit: 'cover', width: '100%' }}
                />
              ) : (
                <Avatar sx={{ width: 150, height: 150, fontSize: '3rem' }}>
                  {person.full_name?.charAt(0)?.toUpperCase() || '?'}
                </Avatar>
              )}
              {canEdit && (
                <Box sx={{ position: 'absolute', bottom: 8, right: 8 }}>
                  <input
                    accept="image/*"
                    style={{ display: 'none' }}
                    id="profile-picture-upload"
                    type="file"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        setSnackbar({ open: true, message: 'Image size must be less than 5MB', severity: 'error' });
                        return;
                      }
                      setUploadingProfilePicture(true);
                      try {
                        // Compress image before upload
                        const compressedFile = await compressImage(file, 1920, 1920, 0.8);
                        const fileExt = compressedFile.name.split('.').pop();
                        const fileName = `profile_${person.person_id}_${Date.now()}.${fileExt}`;
                        const storageRef = ref(storage, `profiles/${person.family_id}/${fileName}`);
                        const snapshot = await uploadBytes(storageRef, compressedFile);
                        const photoUrl = await getDownloadURL(snapshot.ref);
                        await updateDoc(doc(db, 'persons', person.person_id), {
                          profile_photo_url: photoUrl,
                        });
                        setPerson({ ...person, profile_photo_url: photoUrl });
                        setSnackbar({ open: true, message: 'Profile picture updated successfully', severity: 'success' });
                      } catch (error) {
                        console.error('Failed to upload profile picture:', error);
                        setSnackbar({ open: true, message: 'Failed to upload profile picture', severity: 'error' });
                      } finally {
                        setUploadingProfilePicture(false);
                      }
                    }}
                  />
                  <label htmlFor="profile-picture-upload">
                    <IconButton
                      component="span"
                      color="primary"
                      sx={{ bgcolor: 'white', '&:hover': { bgcolor: 'grey.100' } }}
                      disabled={uploadingProfilePicture}
                    >
                      {uploadingProfilePicture ? <CircularProgress size={24} /> : <PhotoCameraIcon />}
                    </IconButton>
                  </label>
                </Box>
              )}
            </Box>
            <CardContent>
              <Typography variant="h4" gutterBottom>
                {person.full_name}
              </Typography>

              <Box sx={{ mt: 1, mb: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {canEdit && (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={openEdit}
                    >
                      Edit details
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      startIcon={<EmailIcon />}
                      onClick={() => setInviteDialogOpen(true)}
                      disabled={!!person.ownerUserId}
                    >
                      Invite to Claim
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      color="success"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => {
                        setSnackbar({ open: true, message: 'Elder verification feature coming soon', severity: 'info' });
                      }}
                    >
                      Verify
                    </Button>
                  </>
                )}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PdfIcon />}
                  onClick={() => {
                    exportPersonProfileToPDF(person, { parents, children, spouses, siblings });
                  }}
                >
                  Export PDF
                </Button>
              </Box>

              {selfRelation && selfRelation.relationship_to_self && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Your relationship: {selfRelation.relationship_to_self}
                </Typography>
              )}

              {person.gender && (
                <Chip label={person.gender} size="small" sx={{ mr: 1, mb: 1 }} />
              )}
              {person.alive_status ? (
                <Chip label="Alive" color="success" size="small" />
              ) : (
                <Chip label="Deceased" color="default" size="small" />
              )}
              {person.verified_by_elder && (
                <Chip label="Verified by Elder" color="primary" size="small" sx={{ ml: 1 }} />
              )}

              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Your relationship to this person
                </Typography>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Relationship to you"
                  value={selfRelation?.relationship_to_self || ''}
                  onChange={handleRelationChange}
                  disabled={relationSaving}
                >
                  <MenuItem value="">
                    <em>Not set</em>
                  </MenuItem>
                  <MenuItem value="self">Self</MenuItem>
                  <MenuItem value="parent">Parent</MenuItem>
                  <MenuItem value="child">Child</MenuItem>
                  <MenuItem value="sibling">Sibling</MenuItem>
                  <MenuItem value="spouse">Spouse</MenuItem>
                  <MenuItem value="grandparent">Grandparent</MenuItem>
                  <MenuItem value="grandchild">Grandchild</MenuItem>
                  <MenuItem value="other">Other</MenuItem>
                </TextField>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Information
            </Typography>
            <Grid container spacing={2}>
              {person.date_of_birth && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Date of Birth
                  </Typography>
                  <Typography variant="body1">
                    {new Date(person.date_of_birth).toLocaleDateString()}
                  </Typography>
                </Grid>
              )}
              {person.date_of_death && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Date of Death
                  </Typography>
                  <Typography variant="body1">
                    {new Date(person.date_of_death).toLocaleDateString()}
                  </Typography>
                </Grid>
              )}
              {person.place_of_birth && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Place of Birth
                  </Typography>
                  <Typography variant="body1">{person.place_of_birth}</Typography>
                </Grid>
              )}
              {person.occupation && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Occupation
                  </Typography>
                  <Typography variant="body1">{person.occupation}</Typography>
                </Grid>
              )}
              {person.clan_name && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Clan
                  </Typography>
                  <Typography variant="body1">{person.clan_name}</Typography>
                </Grid>
              )}
              {person.village_origin && (
                <Grid item xs={6}>
                  <Typography variant="body2" color="text.secondary">
                    Village Origin
                  </Typography>
                  <Typography variant="body1">{person.village_origin}</Typography>
                </Grid>
              )}
            </Grid>
            {person.biography && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="body2" color="text.secondary">
                  Biography
                </Typography>
                <Typography variant="body1" sx={{ mt: 1 }}>
                  {person.biography}
                </Typography>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6" gutterBottom>
                Family Relationships
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setFamilyRelType('parent');
                  setSelectedFamilyPersonId('');
                  setAddFamilyOpen(true);
                }}
              >
                Add family
              </Button>
            </Box>

            {/* Parents section: Father / Mother */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Parents
              </Typography>
              {parents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No parents linked yet.
                </Typography>
              ) : (
                <>
                  {parents.filter(p => p && p.person_id).map((p) => {
                    let roleLabel = 'Parent';
                    if (p.gender === 'male') roleLabel = 'Father';
                    if (p.gender === 'female') roleLabel = 'Mother';
                    return (
                      <Box key={p.person_id} sx={{ display: 'inline-flex', alignItems: 'center', mr: 1, mb: 1 }}>
                        <Chip
                          label={`${roleLabel}: ${p.full_name}`}
                          onClick={() => navigate(`/person/${p.person_id}`)}
                          sx={{ mr: canEdit ? 0.5 : 0 }}
                        />
                        {canEdit && p.relationship_id && (
                          <Tooltip title="Remove relationship">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRelationship(p.relationship_id, 'parent');
                              }}
                              sx={{ ml: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    );
                  })}
                </>
              )}
            </Box>

            {/* Siblings section */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Siblings
              </Typography>
              {siblings.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No siblings linked yet.
                </Typography>
              ) : (
                siblings.filter(s => s && s.person_id).map((s) => {
                  let roleLabel = 'Sibling';
                  if (s.gender === 'male') roleLabel = 'Brother';
                  if (s.gender === 'female') roleLabel = 'Sister';
                  // Note: Siblings don't have direct relationship_id, they're inferred from shared parents
                  // We'll need to find the parent relationship to delete
                  return (
                    <Chip
                      key={s.person_id}
                      label={`${roleLabel}: ${s.full_name}`}
                      sx={{ mr: 1, mb: 1 }}
                      onClick={() => navigate(`/person/${s.person_id}`)}
                    />
                  );
                })
              )}
            </Box>

            {/* Children section */}
            <Box sx={{ mt: 1, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Children
              </Typography>
              {children.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No children linked yet.
                </Typography>
              ) : (
                children.filter(c => c && c.person_id).map((c) => (
                  <Box key={c.person_id} sx={{ display: 'inline-flex', alignItems: 'center', mr: 1, mb: 1 }}>
                    <Chip
                      label={c.full_name}
                      onClick={() => navigate(`/person/${c.person_id}`)}
                      sx={{ mr: canEdit ? 0.5 : 0 }}
                    />
                    {canEdit && c.relationship_id && (
                      <Tooltip title="Remove relationship">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRelationship(c.relationship_id, 'child');
                          }}
                          sx={{ ml: 0.5 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                ))
              )}
            </Box>

            {/* Spouses section */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="subtitle1" gutterBottom>
                Spouses
              </Typography>
              {spouses.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No spouses linked yet.
                </Typography>
              ) : (
                spouses.filter(s => s && s.person_id).map((s) => {
                  const statusLabels = {
                    married: 'Married',
                    divorced: 'Divorced',
                    widowed: 'Widowed',
                    separated: 'Separated',
                  };
                  const statusColors = {
                    married: 'success',
                    divorced: 'error',
                    widowed: 'default',
                    separated: 'warning',
                  };
                  const maritalStatus = s.marital_status || 'married';
                  return (
                    <Box key={s.person_id} sx={{ display: 'inline-flex', alignItems: 'center', mr: 1, mb: 1 }}>
                      <Chip
                        label={s.full_name}
                        onClick={() => navigate(`/person/${s.person_id}`)}
                        sx={{ mr: 0.5 }}
                      />
                      <Chip
                        label={statusLabels[maritalStatus] || 'Married'}
                        color={statusColors[maritalStatus] || 'default'}
                        size="small"
                        variant="outlined"
                        sx={{ mr: canEdit ? 0.5 : 0 }}
                        onClick={canEdit ? () => handleEditMaritalStatus(s) : undefined}
                        style={canEdit ? { cursor: 'pointer' } : {}}
                      />
                      {canEdit && s.relationship_id && (
                        <>
                          <Tooltip title="Edit marital status">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditMaritalStatus(s);
                              }}
                              sx={{ ml: 0.5 }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove relationship">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteRelationship(s.relationship_id, 'spouse');
                              }}
                              sx={{ ml: 0.5 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Documents & Photos
              </Typography>
              {canEdit && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<UploadIcon />}
                  onClick={() => setUploadDialogOpen(true)}
                >
                  Upload
                </Button>
              )}
            </Box>
            {documents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No documents or photos yet. {canEdit && 'Click "Upload" to add photos or documents.'}
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {documents.map((doc) => (
                  <Grid item xs={6} sm={4} md={3} key={doc.document_id}>
                    <Card sx={{ position: 'relative' }}>
                      {doc.document_type === 'photo' && (
                        <CardMedia
                          component="img"
                          height="200"
                          image={doc.file_url}
                          alt={doc.title || 'Photo'}
                          sx={{ objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => window.open(doc.file_url, '_blank')}
                        />
                      )}
                      {doc.document_type !== 'photo' && (
                        <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5', cursor: 'pointer' }} onClick={() => window.open(doc.file_url, '_blank')}>
                          <Typography variant="h4" color="text.secondary">
                            {doc.document_type === 'certificate' ? '📜' : doc.document_type === 'audio' ? '🎵' : doc.document_type === 'video' ? '🎬' : '📄'}
                          </Typography>
                        </Box>
                      )}
                      <CardContent>
                        <Typography variant="body2" noWrap title={doc.title}>
                          {doc.title || 'Untitled'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {doc.document_type}
                        </Typography>
                        {canEdit && (
                          <IconButton
                            size="small"
                            color="error"
                            sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(255,255,255,0.9)' }}
                            onClick={async () => {
                              if (window.confirm('Delete this document?')) {
                                try {
                                  // Delete from Storage
                                  if (doc.file_path) {
                                    const fileRef = ref(storage, doc.file_path);
                                    await deleteObject(fileRef);
                                  }
                                  // Delete from Firestore
                                  await deleteDoc(doc(db, 'documents', doc.document_id));
                                  // Refresh documents
                                  await fetchDocuments(person.person_id, person.family_id);
                                } catch (error) {
                                  console.error('Failed to delete document:', error);
                                  setSnackbar({ open: true, message: 'Failed to delete document', severity: 'error' });
                                }
                              }
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>

          <Paper sx={{ p: 3, mb: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Stories & Oral History
              </Typography>
              {canEdit && (
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<BookIcon />}
                  onClick={() => setStoryDialogOpen(true)}
                >
                  Add Story
                </Button>
              )}
            </Box>
            {stories.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No stories yet. {canEdit && 'Click "Add Story" to preserve oral history and family stories.'}
              </Typography>
            ) : (
              <Box>
                {stories.map((story) => (
                  <Card key={story.story_id} sx={{ mb: 2 }}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                        <Typography variant="h6" component="div">
                          {story.title || 'Untitled Story'}
                        </Typography>
                        {canEdit && (
                          <Box>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setEditingStoryId(story.story_id);
                                setStoryTitle(story.title || '');
                                setStoryContent(story.content || story.transcription || '');
                                setStoryNarrator(story.narrator || '');
                                setStoryDate(story.recorded_date || '');
                                setStoryLocation(story.recorded_location || '');
                                setStoryTags(story.tags ? story.tags.join(', ') : '');
                                setStoryAudioFile(null);
                                setStoryDialogOpen(true);
                              }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={async () => {
                                if (window.confirm('Delete this story?')) {
                                  try {
                                    // Delete audio file from Storage if exists
                                    if (story.audio_url && story.audio_path) {
                                      const audioRef = ref(storage, story.audio_path);
                                      await deleteObject(audioRef);
                                    }
                                    // Delete from Firestore
                                    await deleteDoc(doc(db, 'stories', story.story_id));
                                    // Refresh stories
                                    await fetchStories(person.person_id, person.family_id);
                                    setSnackbar({ open: true, message: 'Story deleted successfully', severity: 'success' });
                                  } catch (error) {
                                    console.error('Failed to delete story:', error);
                                    setSnackbar({ open: true, message: 'Failed to delete story', severity: 'error' });
                                  }
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </Box>
                      {story.narrator && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Narrator: {story.narrator}
                        </Typography>
                      )}
                      {(story.recorded_date || story.recorded_location) && (
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {story.recorded_date && new Date(story.recorded_date).toLocaleDateString()}
                          {story.recorded_date && story.recorded_location && ' • '}
                          {story.recorded_location}
                        </Typography>
                      )}
                      <Typography variant="body1" sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>
                        {story.content || story.transcription}
                      </Typography>
                      {story.audio_url && (
                        <Box sx={{ mt: 2 }}>
                          <audio controls style={{ width: '100%', maxWidth: '500px' }}>
                            <source src={story.audio_url} type="audio/mpeg" />
                            <source src={story.audio_url} type="audio/wav" />
                            <source src={story.audio_url} type="audio/ogg" />
                            Your browser does not support the audio element.
                          </audio>
                        </Box>
                      )}
                      {story.tags && story.tags.length > 0 && (
                        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {story.tags.map((tag, idx) => (
                            <Chip key={idx} label={tag} size="small" variant="outlined" />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Add/Edit Story Dialog */}
      <Dialog open={storyDialogOpen} onClose={() => {
        setStoryDialogOpen(false);
        setEditingStoryId(null);
        setStoryTitle('');
        setStoryContent('');
        setStoryNarrator('');
        setStoryDate('');
        setStoryLocation('');
        setStoryTags('');
        setStoryAudioFile(null);
      }} fullWidth maxWidth="md">
        <DialogTitle>{editingStoryId ? 'Edit Story or Oral History' : 'Add Story or Oral History'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="normal"
            label="Story Title"
            value={storyTitle}
            onChange={(e) => setStoryTitle(e.target.value)}
            placeholder="e.g., Grandfather's Journey to the City"
          />
          <TextField
            fullWidth
            margin="normal"
            label="Story Content / Transcription"
            value={storyContent}
            onChange={(e) => setStoryContent(e.target.value)}
            multiline
            rows={6}
            placeholder="Write the story here or paste transcription..."
          />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Narrator (Who told this story?)"
                value={storyNarrator}
                onChange={(e) => setStoryNarrator(e.target.value)}
                placeholder="e.g., Grandmother Mary"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Recording Date"
                type="date"
                value={storyDate}
                onChange={(e) => setStoryDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Recording Location"
                value={storyLocation}
                onChange={(e) => setStoryLocation(e.target.value)}
                placeholder="e.g., Lagos, Nigeria"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                margin="normal"
                label="Tags (comma-separated)"
                value={storyTags}
                onChange={(e) => setStoryTags(e.target.value)}
                placeholder="e.g., migration, family history, traditions"
                helperText="Separate tags with commas"
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, mb: 2 }}>
            <input
              accept="audio/*"
              style={{ display: 'none' }}
              id="audio-upload"
              type="file"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  // Check file size (max 50MB for audio)
                  if (file.size > 50 * 1024 * 1024) {
                    setSnackbar({ open: true, message: 'Audio file size must be less than 50MB', severity: 'error' });
                    return;
                  }
                  setStoryAudioFile(file);
                }
              }}
            />
            <label htmlFor="audio-upload">
              <Button
                variant="outlined"
                component="span"
                fullWidth
                startIcon={<VolumeUpIcon />}
                sx={{ py: 2 }}
              >
                {storyAudioFile ? storyAudioFile.name : 'Upload Audio Recording (Optional)'}
              </Button>
            </label>
            {storyAudioFile && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {(storyAudioFile.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
                <IconButton size="small" onClick={() => setStoryAudioFile(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setStoryDialogOpen(false);
            setEditingStoryId(null);
            setStoryTitle('');
            setStoryContent('');
            setStoryNarrator('');
            setStoryDate('');
            setStoryLocation('');
            setStoryTags('');
            setStoryAudioFile(null);
          }} disabled={savingStory}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!storyContent || !person) return;
              
              setSavingStory(true);
              try {
                let audioUrl = null;
                let audioPath = null;

                // Upload audio file if provided (new file)
                if (storyAudioFile) {
                  const fileExt = storyAudioFile.name.split('.').pop();
                  const fileName = `${person.person_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                  const storageRef = ref(storage, `stories/${person.family_id}/${fileName}`);
                  const snapshot = await uploadBytes(storageRef, storyAudioFile);
                  audioUrl = await getDownloadURL(snapshot.ref);
                  audioPath = snapshot.ref.fullPath;
                }

                // Parse tags
                const tagsArray = storyTags
                  ? storyTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                  : [];

                if (editingStoryId) {
                  // Update existing story
                  const storyRef = doc(db, 'stories', editingStoryId);
                  const updateData = {
                    title: storyTitle || null,
                    content: storyContent,
                    transcription: storyContent,
                    narrator: storyNarrator || null,
                    recorded_date: storyDate || null,
                    recorded_location: storyLocation || null,
                    tags: tagsArray,
                    updated_at: serverTimestamp(),
                  };
                  // Only update audio if new file was uploaded
                  if (audioUrl && audioPath) {
                    updateData.audio_url = audioUrl;
                    updateData.audio_path = audioPath;
                    updateData.audio_file_name = storyAudioFile?.name || null;
                    updateData.audio_file_size = storyAudioFile?.size || null;
                  }
                  await updateDoc(storyRef, updateData);
                  setSnackbar({ open: true, message: 'Story updated successfully', severity: 'success' });
                } else {
                  // Create new story record in Firestore
                  const storiesRef = collection(db, 'stories');
                  await addDoc(storiesRef, {
                    person_id: person.person_id,
                    family_id: person.family_id,
                    title: storyTitle || null,
                    content: storyContent,
                    transcription: storyContent,
                    narrator: storyNarrator || null,
                    recorded_date: storyDate || null,
                    recorded_location: storyLocation || null,
                    tags: tagsArray,
                    audio_url: audioUrl,
                    audio_path: audioPath,
                    audio_file_name: storyAudioFile?.name || null,
                    audio_file_size: storyAudioFile?.size || null,
                    created_by_user_id: user.user_id || user.uid,
                    created_at: serverTimestamp(),
                  });
                  setSnackbar({ open: true, message: 'Story added successfully', severity: 'success' });
                }

                // Refresh stories
                await fetchStories(person.person_id, person.family_id);

                // Close dialog and reset
                setStoryDialogOpen(false);
                setEditingStoryId(null);
                setStoryTitle('');
                setStoryContent('');
                setStoryNarrator('');
                setStoryDate('');
                setStoryLocation('');
                setStoryTags('');
                setStoryAudioFile(null);
              } catch (error) {
                console.error('Failed to save story:', error);
                setSnackbar({ open: true, message: 'Failed to save story. Please try again.', severity: 'error' });
              } finally {
                setSavingStory(false);
              }
            }}
            variant="contained"
            disabled={!storyContent || savingStory}
            startIcon={<BookIcon />}
          >
            {savingStory ? 'Saving...' : editingStoryId ? 'Update Story' : 'Save Story'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Family Relationship Dialog */}
      <Dialog open={addFamilyOpen} onClose={() => setAddFamilyOpen(false)} fullWidth maxWidth="sm" disableEnforceFocus>
        <DialogTitle>Add family relationship for {person.full_name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Choose the type of family relationship and the person to link.
          </Typography>
          <TextField
            select
            label="Relationship type"
            fullWidth
            margin="normal"
            value={familyRelType}
            onChange={(e) => {
              setFamilyRelType(e.target.value);
              setSelectedFamilyPersonId(''); // Reset selection when type changes
              setMaritalStatus('married'); // Reset marital status when type changes
            }}
          >
            <MenuItem value="parent">Parent of this person</MenuItem>
            <MenuItem value="child">Child of this person</MenuItem>
            <MenuItem value="spouse">Spouse of this person</MenuItem>
          </TextField>
          {familyRelType === 'spouse' && (
            <TextField
              select
              label="Marital Status"
              fullWidth
              margin="normal"
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value)}
              helperText="Select the current status of this marriage"
            >
              <MenuItem value="married">Married</MenuItem>
              <MenuItem value="divorced">Divorced</MenuItem>
              <MenuItem value="widowed">Widowed</MenuItem>
              <MenuItem value="separated">Separated</MenuItem>
            </TextField>
          )}
          <TextField
            select
            label="Family member"
            fullWidth
            margin="normal"
            value={selectedFamilyPersonId}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '__NEW__') {
                setAddNewPersonOpen(true);
              } else {
                setSelectedFamilyPersonId(value);
              }
            }}
            helperText="Select an existing member or add a new one"
          >
            {allFamilyPersons.filter(p => p && p.person_id).map((p) => (
              <MenuItem key={p.person_id} value={p.person_id}>
                {p.full_name}
              </MenuItem>
            ))}
            <MenuItem value="__NEW__">
              <em>+ Add new member not listed</em>
            </MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddFamilyOpen(false)}>Cancel</Button>
          <Button
            onClick={async () => {
              if (!person || !selectedFamilyPersonId) return;
              try {
                await handleAddFamilyRelationship(selectedFamilyPersonId);
                setAddFamilyOpen(false);
                setSelectedFamilyPersonId('');
                setMaritalStatus('married'); // Reset marital status
                setSnackbar({ open: true, message: 'Family relationship added successfully', severity: 'success' });
              } catch (error) {
                console.error('Failed to add family relationship:', error);
                setSnackbar({ open: true, message: 'Failed to add family relationship. Please try again.', severity: 'error' });
              }
            }}
            disabled={!selectedFamilyPersonId}
            variant="contained"
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add New Person Dialog */}
      <Dialog
        open={addNewPersonOpen}
        onClose={() => {
          setAddNewPersonOpen(false);
          setSelectedFamilyPersonId(''); // Reset selection when canceling
        }}
        fullWidth
        maxWidth="sm"
        disableEnforceFocus
      >
        <DialogTitle>Add New Family Member</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Create a new family member and link them as {familyRelType === 'parent' ? 'a parent' : familyRelType === 'child' ? 'a child' : 'a spouse'} of {person.full_name}.
          </Typography>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              fullWidth
              margin="normal"
              label="Full Name *"
              name="full_name"
              value={newPersonValues.full_name}
              onChange={handleNewPersonChange}
              required
            />
            <TextField
              select
              fullWidth
              margin="normal"
              label="Gender"
              name="gender"
              value={newPersonValues.gender}
              onChange={handleNewPersonChange}
            >
              <MenuItem value="">Not specified</MenuItem>
              <MenuItem value="male">Male</MenuItem>
              <MenuItem value="female">Female</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
            <TextField
              fullWidth
              margin="normal"
              label="Date of Birth"
              name="date_of_birth"
              type="date"
              value={newPersonValues.date_of_birth || ''}
              onChange={handleNewPersonChange}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Place of Birth"
              name="place_of_birth"
              value={newPersonValues.place_of_birth}
              onChange={handleNewPersonChange}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Occupation"
              name="occupation"
              value={newPersonValues.occupation}
              onChange={handleNewPersonChange}
            />
            <Autocomplete
              freeSolo
              options={commonValues.clan_names}
              value={newPersonValues.clan_name || null}
              onChange={(event, newValue) => {
                handleNewPersonChange({ target: { name: 'clan_name', value: newValue || '' } });
              }}
              onInputChange={(event, newInputValue) => {
                handleNewPersonChange({ target: { name: 'clan_name', value: newInputValue } });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  margin="normal"
                  label="Clan Name"
                  name="clan_name"
                  placeholder="Select or type a new clan name"
                  helperText={
                    commonValues.clan_names.length > 0
                      ? `Select from family: ${commonValues.clan_names.slice(0, 3).join(', ')}${commonValues.clan_names.length > 3 ? '...' : ''} or type a new one`
                      : 'Type a clan name (e.g., Umunna, Idile)'
                  }
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option}>
                  {option}
                </li>
              )}
              noOptionsText="Type to add a new clan name"
            />
            <Autocomplete
              freeSolo
              options={commonValues.village_origins}
              value={newPersonValues.village_origin || null}
              onChange={(event, newValue) => {
                handleNewPersonChange({ target: { name: 'village_origin', value: newValue || '' } });
              }}
              onInputChange={(event, newInputValue) => {
                handleNewPersonChange({ target: { name: 'village_origin', value: newInputValue } });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  margin="normal"
                  label="Village/Town Origin"
                  name="village_origin"
                  placeholder="Select or type a new village/town"
                  helperText={
                    commonValues.village_origins.length > 0
                      ? `Select from family: ${commonValues.village_origins.slice(0, 3).join(', ')}${commonValues.village_origins.length > 3 ? '...' : ''} or type a new one`
                      : 'Type a village or town name'
                  }
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option}>
                  {option}
                </li>
              )}
              noOptionsText="Type to add a new village/town name"
            />
            <TextField
              fullWidth
              margin="normal"
              label="Biography / Story"
              name="biography"
              multiline
              minRows={3}
              value={newPersonValues.biography}
              onChange={handleNewPersonChange}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddNewPersonOpen(false);
              setSelectedFamilyPersonId(''); // Reset selection when canceling
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleCreateNewPerson} variant="contained" disabled={!newPersonValues.full_name.trim()}>
            Create & Link
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Person Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="error" />
          Delete Family Member
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete <strong>{person?.full_name}</strong> from the family tree?
            <br /><br />
            This will:
            <ul>
              <li>Remove this person from the tree</li>
              <li>Remove all relationships connected to this person</li>
              <li>This action cannot be undone</li>
            </ul>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeletePerson}
            color="error"
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? null : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Invite to Claim Dialog */}
      <Dialog open={inviteDialogOpen} onClose={() => {
        setInviteDialogOpen(false);
        setInviteSuccess(false);
        setInviteEmail('');
      }} fullWidth maxWidth="sm">
        <DialogTitle>Invite to Claim Account</DialogTitle>
        <DialogContent>
          {!inviteSuccess ? (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Send an invitation to <strong>{person?.full_name}</strong> to claim their profile. 
                They will receive a link to sign up and claim this account.
              </DialogContentText>
              <TextField
                fullWidth
                margin="normal"
                label="Email Address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter their email address"
                helperText="An automated email will be sent to this address with a claim link"
              />
            </>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2, textAlign: 'center' }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Invitation Email Sent!
                </Typography>
                <Typography variant="body1">
                  An invitation email has been automatically sent to <strong>{inviteEmail}</strong>.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  The recipient will receive an email with a link to claim their profile and sign up.
                </Typography>
              </DialogContentText>
            </>
          )}
        </DialogContent>
        <DialogActions>
          {!inviteSuccess ? (
            <>
              <Button onClick={() => {
                setInviteDialogOpen(false);
                setInviteEmail('');
              }} disabled={inviteSending}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!inviteEmail || !person) return;
                  
                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                  if (!emailRegex.test(inviteEmail)) {
                    setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'warning' });
                    return;
                  }

                  setInviteSending(true);
                  try {
                    // Generate invitation token
                    const token = crypto.randomUUID();
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

                    // Store invitation in Firestore
                    // The email will be sent automatically by Firebase Function trigger
                    const invitationsRef = collection(db, 'personInvitations');
                    await addDoc(invitationsRef, {
                      person_id: person.person_id,
                      family_id: person.family_id,
                      email: inviteEmail.trim().toLowerCase(),
                      invited_by_user_id: user.user_id,
                      token: token,
                      status: 'pending',
                      expires_at: expiresAt,
                      person_name: person.full_name, // Store person name for email
                      created_at: serverTimestamp(),
                    });

                    // Show success message (email is sent automatically by function)
                    setInviteSuccess(true);
                  } catch (error) {
                    console.error('Failed to create invitation:', error);
                    setSnackbar({ open: true, message: 'Failed to create invitation. Please try again.', severity: 'error' });
                  } finally {
                    setInviteSending(false);
                  }
                }}
                variant="contained"
                disabled={!inviteEmail || inviteSending}
                startIcon={<EmailIcon />}
              >
                {inviteSending ? 'Creating...' : 'Create Invitation'}
              </Button>
            </>
          ) : (
            <Button
              onClick={() => {
                setInviteDialogOpen(false);
                setInviteSuccess(false);
                setInviteEmail('');
              }}
              variant="contained"
            >
              Done
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} fullWidth maxWidth="sm" disableEnforceFocus>
        <DialogTitle>Upload Document or Photo</DialogTitle>
        <DialogContent>
          <TextField
            select
            fullWidth
            margin="normal"
            label="Document Type"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
          >
            <MenuItem value="photo">Photo</MenuItem>
            <MenuItem value="certificate">Certificate</MenuItem>
            <MenuItem value="audio">Audio</MenuItem>
            <MenuItem value="video">Video</MenuItem>
            <MenuItem value="other">Other Document</MenuItem>
          </TextField>
          <TextField
            fullWidth
            margin="normal"
            label="Title"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="e.g., Family Photo 2020"
          />
          <TextField
            fullWidth
            margin="normal"
            label="Description (Optional)"
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
            multiline
            rows={2}
          />
          <Box sx={{ mt: 2, mb: 2 }}>
            <input
              accept={uploadType === 'photo' ? 'image/*' : uploadType === 'audio' ? 'audio/*' : uploadType === 'video' ? 'video/*' : '*'}
              style={{ display: 'none' }}
              id="file-upload"
              type="file"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  // Check file size (max 10MB)
                  if (file.size > 10 * 1024 * 1024) {
                    setSnackbar({ open: true, message: 'File size must be less than 10MB', severity: 'error' });
                    return;
                  }
                  setUploadFile(file);
                }
              }}
            />
            <label htmlFor="file-upload">
              <Button
                variant="outlined"
                component="span"
                fullWidth
                startIcon={<PhotoCameraIcon />}
                sx={{ py: 2 }}
              >
                {uploadFile ? uploadFile.name : 'Choose File'}
              </Button>
            </label>
            {uploadFile && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
                <IconButton size="small" onClick={() => setUploadFile(null)}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setUploadDialogOpen(false);
            setUploadFile(null);
            setUploadTitle('');
            setUploadDescription('');
            setUploadType('photo');
          }} disabled={uploading}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!uploadFile || !person) return;
              
              setUploading(true);
              try {
                let fileToUpload = uploadFile;
                // Compress images before upload
                if (uploadType === 'photo' && uploadFile.type.startsWith('image/')) {
                  fileToUpload = await compressImage(uploadFile, 1920, 1920, 0.8);
                }
                // Create unique filename
                const fileExt = fileToUpload.name.split('.').pop();
                const fileName = `${person.person_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const storageRef = ref(storage, `documents/${person.family_id}/${fileName}`);

                // Upload file to Firebase Storage
                const snapshot = await uploadBytes(storageRef, fileToUpload);
                const downloadURL = await getDownloadURL(snapshot.ref);

                // Create document record in Firestore
                const documentsRef = collection(db, 'documents');
                await addDoc(documentsRef, {
                  person_id: person.person_id,
                  family_id: person.family_id,
                  document_type: uploadType,
                  file_url: downloadURL,
                  file_path: snapshot.ref.fullPath,
                  file_name: uploadFile.name,
                  file_size: uploadFile.size,
                  mime_type: uploadFile.type,
                  title: uploadTitle || uploadFile.name,
                  description: uploadDescription || null,
                  uploaded_by_user_id: user.user_id || user.uid,
                  created_at: serverTimestamp(),
                });

                // Refresh documents
                await fetchDocuments(person.person_id, person.family_id);

                // Close dialog and reset
                setUploadDialogOpen(false);
                setUploadFile(null);
                setUploadTitle('');
                setUploadDescription('');
                setUploadType('photo');
              } catch (error) {
                console.error('Failed to upload document:', error);
                setSnackbar({ open: true, message: 'Failed to upload document. Please try again.', severity: 'error' });
              } finally {
                setUploading(false);
              }
            }}
            variant="contained"
            disabled={!uploadFile || uploading}
            startIcon={<UploadIcon />}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Person Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm" disableEnforceFocus>
        <DialogTitle>Edit {person.full_name}</DialogTitle>
        <DialogContent>
          {editValues && (
            <Box component="form" sx={{ mt: 2 }}>
              <TextField
                fullWidth
                margin="normal"
                label="Full Name"
                name="full_name"
                value={editValues.full_name}
                onChange={handleEditChange}
              />
              <TextField
                select
                fullWidth
                margin="normal"
                label="Gender"
                name="gender"
                value={editValues.gender}
                onChange={handleEditChange}
              >
                <MenuItem value="male">Male</MenuItem>
                <MenuItem value="female">Female</MenuItem>
                <MenuItem value="other">Other</MenuItem>
              </TextField>
              <TextField
                fullWidth
                margin="normal"
                label="Date of Birth"
                name="date_of_birth"
                type="date"
                value={editValues.date_of_birth || ''}
                onChange={handleEditChange}
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                fullWidth
                margin="normal"
                label="Date of Death"
                name="date_of_death"
                type="date"
                value={editValues.date_of_death || ''}
                onChange={handleEditChange}
                InputLabelProps={{ shrink: true }}
              />
              <Autocomplete
                freeSolo
                options={commonValues.places_of_birth}
                value={editValues.place_of_birth || null}
                onChange={(event, newValue) => {
                  handleEditChange({ target: { name: 'place_of_birth', value: newValue || '' } });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    margin="normal"
                    label="Place of Birth"
                    name="place_of_birth"
                    helperText={commonValues.places_of_birth.length > 0 ? `Common: ${commonValues.places_of_birth.slice(0, 3).join(', ')}` : ''}
                  />
                )}
              />
              <Autocomplete
                freeSolo
                options={commonValues.occupations}
                value={editValues.occupation || null}
                onChange={(event, newValue) => {
                  handleEditChange({ target: { name: 'occupation', value: newValue || '' } });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    margin="normal"
                    label="Occupation"
                    name="occupation"
                    helperText={commonValues.occupations.length > 0 ? `Common: ${commonValues.occupations.slice(0, 3).join(', ')}` : ''}
                  />
                )}
              />
              <Autocomplete
                freeSolo
                options={commonValues.clan_names}
                value={editValues.clan_name || null}
                onChange={(event, newValue) => {
                  handleEditChange({ target: { name: 'clan_name', value: newValue || '' } });
                }}
                onInputChange={(event, newInputValue) => {
                  handleEditChange({ target: { name: 'clan_name', value: newInputValue } });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    margin="normal"
                    label="Clan Name"
                    name="clan_name"
                    placeholder="Select or type a new clan name"
                    helperText={
                      commonValues.clan_names.length > 0
                        ? `Select from family: ${commonValues.clan_names.slice(0, 3).join(', ')}${commonValues.clan_names.length > 3 ? '...' : ''} or type a new one`
                        : 'Type a clan name (e.g., Umunna, Idile)'
                    }
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option}>
                    {option}
                  </li>
                )}
                noOptionsText="Type to add a new clan name"
              />
              <Autocomplete
                freeSolo
                options={commonValues.village_origins}
                value={editValues.village_origin || null}
                onChange={(event, newValue) => {
                  handleEditChange({ target: { name: 'village_origin', value: newValue || '' } });
                }}
                onInputChange={(event, newInputValue) => {
                  handleEditChange({ target: { name: 'village_origin', value: newInputValue } });
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    margin="normal"
                    label="Village/Town Origin"
                    name="village_origin"
                    placeholder="Select or type a new village/town"
                    helperText={
                      commonValues.village_origins.length > 0
                        ? `Select from family: ${commonValues.village_origins.slice(0, 3).join(', ')}${commonValues.village_origins.length > 3 ? '...' : ''} or type a new one`
                        : 'Type a village or town name'
                    }
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props} key={option}>
                    {option}
                  </li>
                )}
                noOptionsText="Type to add a new village/town name"
              />
              <TextField
                fullWidth
                margin="normal"
                label="Biography / Story"
                name="biography"
                multiline
                minRows={3}
                value={editValues.biography}
                onChange={handleEditChange}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      {/* Edit Marital Status Dialog */}
      <Dialog open={editMaritalStatusOpen} onClose={() => setEditMaritalStatusOpen(false)} fullWidth maxWidth="sm" disableEnforceFocus>
        <DialogTitle>Edit Marital Status</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Update the marital status for {editingSpouseRel?.full_name || 'this spouse'}.
          </Typography>
          <TextField
            select
            label="Marital Status"
            fullWidth
            margin="normal"
            value={editingMaritalStatus}
            onChange={(e) => setEditingMaritalStatus(e.target.value)}
          >
            <MenuItem value="married">Married</MenuItem>
            <MenuItem value="divorced">Divorced</MenuItem>
            <MenuItem value="widowed">Widowed</MenuItem>
            <MenuItem value="separated">Separated</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditMaritalStatusOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveMaritalStatus} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PersonDetail;

