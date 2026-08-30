import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Box,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Autocomplete,
  Snackbar,
  Alert,
  CircularProgress,
} from '@mui/material';
import { Delete as DeleteIcon, Warning as WarningIcon, Email as EmailIcon, CheckCircle as CheckCircleIcon, PhotoCamera as PhotoCameraIcon, Upload as UploadIcon, Close as CloseIcon, Book as BookIcon, VolumeUp as VolumeUpIcon, Edit as EditIcon, PictureAsPdf as PdfIcon, History as HistoryIcon, PendingActions as PendingActionsIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import api from '../services/api';
import { exportPersonProfileToPDF } from '../utils/pdfExport';
import { compressImage } from '../utils/imageCompression';
import { useAuth } from '../contexts/AuthContext';
import { PersonDetailSkeleton } from '../components/SkeletonLoaders';
import PendingChangesDialog from '../components/PendingChangesDialog';
import EditHistoryDialog from '../components/EditHistoryDialog';

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
  const [pendingChangesOpen, setPendingChangesOpen] = useState(false);
  const [editHistoryOpen, setEditHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchPersonDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  // Fetch common values from existing family members
  useEffect(() => {
    const fetchCommonValues = async () => {
      if (!person?.family_id) return;
      try {
        const res = await api.get(`/persons/family/${person.family_id}`);
        const persons = res.data.persons || [];
        
        const clans = new Set();
        const villages = new Set();
        const places = new Set();
        const occupations = new Set();

        persons.forEach((p) => {
          if (p.clan_name) clans.add(p.clan_name);
          if (p.village_origin) villages.add(p.village_origin);
          if (p.place_of_birth) places.add(p.place_of_birth);
          if (p.occupation) occupations.add(p.occupation);
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
      const res = await api.get(`/persons/${personId}`);
      const personData = res.data.person;
      if (!personData) {
        setPerson(null);
        setFamily(null);
      } else {
        setPerson(personData);
        await Promise.all([
          fetchFamily(personData.family_id),
          fetchFamilyPersons(personData.family_id, personData.person_id),
          fetchRelationships(personData, res.data.relationships || []),
          fetchDocuments(personData.person_id, personData.family_id),
          fetchStories(personData.person_id, personData.family_id),
        ]);
      }
    } catch (error) {
      console.error('Failed to fetch person details:', error);
      setPerson(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchFamilyPersons = async (familyId, currentPersonId) => {
    if (!familyId) return;
    try {
      const res = await api.get(`/persons/family/${familyId}`);
      const list = (res.data.persons || [])
        .filter((p) => p && p.person_id !== currentPersonId)
        .filter((p) => p && p.person_id);
      setAllFamilyPersons(list);
    } catch (error) {
      console.error('Failed to fetch family persons:', error);
      setAllFamilyPersons([]);
    }
  };

  const fetchDocuments = async (personId, familyId) => {
    try {
      const res = await api.get(`/documents/person/${personId}`);
      setDocuments(res.data.documents || []);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setDocuments([]);
    }
  };

  const fetchStories = async (personId, familyId) => {
    try {
      const res = await api.get(`/stories/person/${personId}`);
      const storiesList = res.data.stories || [];
      storiesList.sort((a, b) => {
        const dateA = a.recorded_date ? new Date(a.recorded_date) : new Date(a.created_at || 0);
        const dateB = b.recorded_date ? new Date(b.recorded_date) : new Date(b.created_at || 0);
        return dateB - dateA;
      });
      setStories(storiesList);
    } catch (error) {
      console.error('Failed to fetch stories:', error);
      setStories([]);
    }
  };

  const fetchRelationships = async (personData, preloadedRelationships) => {
    const familyId = personData.family_id;
    if (!familyId) return;

    try {
      let relationships = preloadedRelationships;
      if (!relationships || relationships.length === 0) {
        const res = await api.get(`/relationships/family/${familyId}`);
        relationships = res.data.relationships || [];
      }

      const pid = parseInt(personData.person_id);

      // Helper to safely get person data from relationship record
      const getPersonData = (data) => {
        if (!data) return {};
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error('Failed to parse person data:', e);
            return {};
          }
        }
        return data;
      };

      // Parents: relationships where type='parent' and person2_id = this person (child)
      const parentRels = relationships.filter(
        (r) => r.relationship_type === 'parent' && parseInt(r.person2_id) === pid
      );
      
      const parentPersons = parentRels.map((r) => {
        const pData = getPersonData(r.person1_data);
        return {
          ...pData,
          person_id: r.person1_id,
          relationship_id: r.relationship_id,
        };
      });
      setParents(parentPersons.filter((p) => p && p.person_id));

      // Children: relationships where type='parent' and person1_id = this person (parent)
      const childRels = relationships.filter(
        (r) => r.relationship_type === 'parent' && parseInt(r.person1_id) === pid
      );
      const childPersons = childRels.map((r) => {
        const pData = getPersonData(r.person2_data);
        return {
          ...pData,
          person_id: r.person2_id,
          relationship_id: r.relationship_id,
        };
      });
      setChildren(childPersons.filter((c) => c && c.person_id));

      // Siblings: other persons who share a parent with this person
      const siblingMap = new Map();
      for (const parent of parentPersons) {
        if (!parent || !parent.person_id) continue;
        const siblingRels = relationships.filter(
          (r) => r.relationship_type === 'parent' && parseInt(r.person1_id) === parseInt(parent.person_id) && parseInt(r.person2_id) !== pid
        );
        for (const sRel of siblingRels) {
          const sData = getPersonData(sRel.person2_data);
          if (!siblingMap.has(sRel.person2_id)) {
            siblingMap.set(sRel.person2_id, {
              ...sData,
              person_id: sRel.person2_id,
            });
          }
        }
      }
      setSiblings(Array.from(siblingMap.values()).filter((s) => s && s.person_id));

      // Spouses: relationships where type='spouse' and this person is either person1 or person2
      const spouseRels = relationships.filter(
        (r) => r.relationship_type === 'spouse' && (parseInt(r.person1_id) === pid || parseInt(r.person2_id) === pid)
      );
      const spousePersons = spouseRels.map((r) => {
        const isPerson1 = parseInt(r.person1_id) === pid;
        const spouseId = isPerson1 ? r.person2_id : r.person1_id;
        const pData = getPersonData(isPerson1 ? r.person2_data : r.person1_data);
        return {
          ...pData,
          person_id: spouseId,
          relationship_id: r.relationship_id,
          marital_status: r.notes || 'married', // Use notes for marital status fallback
        };
      });
      setSpouses(spousePersons.filter((s) => s && s.person_id));
    } catch (error) {
      console.error('Failed to fetch relationships:', error);
      setParents([]);
      setChildren([]);
      setSpouses([]);
      setSiblings([]);
    }
  };

  const fetchFamily = async (familyId) => {
    if (!familyId) return;
    try {
      const res = await api.get(`/families/${familyId}`);
      if (res.data.family) {
        setFamily(res.data.family);
      } else {
        setFamily(null);
      }
    } catch (error) {
      console.error('Failed to fetch family:', error);
      setFamily(null);
    }
  };

  const fetchUserRelation = async (personData, currentUser) => {
    // TODO: Backend doesn't yet have a user-person relationship endpoint
    setSelfRelation(null);
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
    ((person.owner_user_id && String(person.owner_user_id) === String(user.user_id)) ||
      (person.created_by_user_id && String(person.created_by_user_id) === String(user.user_id)) ||
      (family && String(family.created_by_user_id) === String(user.user_id)));

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
    if (!person || !editValues || !user) return;
    
    try {
      const isElder = (family && family.created_by_user_id === user.user_id);
      
      if (isElder) {
        const updates = {
          full_name: editValues.full_name,
          gender: editValues.gender || null,
          date_of_birth: editValues.date_of_birth || null,
          date_of_death: editValues.date_of_death || null,
          place_of_birth: editValues.place_of_birth || null,
          occupation: editValues.occupation || null,
          biography: editValues.biography || null,
          clan_name: editValues.clan_name || null,
          village_origin: editValues.village_origin || null,
        };
        await api.put(`/persons/${person.person_id}`, updates);
        
        setPerson((prev) => (prev ? { ...prev, ...updates } : prev));
        setEditOpen(false);
        setSnackbar({ open: true, message: 'Person details updated successfully', severity: 'success' });
      } else {
        // For non-elders, we still submit via API but could route through an approval flow
        // For now, allow direct edit
        const updates = {
          full_name: editValues.full_name,
          gender: editValues.gender || null,
          date_of_birth: editValues.date_of_birth || null,
          date_of_death: editValues.date_of_death || null,
          place_of_birth: editValues.place_of_birth || null,
          occupation: editValues.occupation || null,
          biography: editValues.biography || null,
          clan_name: editValues.clan_name || null,
          village_origin: editValues.village_origin || null,
        };
        await api.put(`/persons/${person.person_id}`, updates);
        
        setPerson((prev) => (prev ? { ...prev, ...updates } : prev));
        setEditOpen(false);
        setSnackbar({ open: true, message: 'Person details updated successfully', severity: 'success' });
      }
    } catch (error) {
      console.error('Failed to save edit:', error);
      setSnackbar({ open: true, message: 'Failed to save changes. Please try again.', severity: 'error' });
    }
  };

  const handleRelationChange = async (event) => {
    if (!person || !user) return;
    const value = event.target.value;
    setRelationSaving(true);
    try {
      // TODO: Backend doesn't yet support user-person relationships
      setSelfRelation((prev) => (prev ? { ...prev, relationship_to_self: value } : { relationship_to_self: value }));
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
      const res = await api.post('/persons', {
        family_id: person.family_id,
        full_name: newPersonValues.full_name.trim(),
        gender: newPersonValues.gender || null,
        date_of_birth: newPersonValues.date_of_birth || null,
        place_of_birth: newPersonValues.place_of_birth || null,
        occupation: newPersonValues.occupation || null,
        biography: newPersonValues.biography || null,
        clan_name: newPersonValues.clan_name || null,
        village_origin: newPersonValues.village_origin || null,
      });

      const newPersonId = res.data.person.person_id;

      // Now create the relationship based on the selected type
      await handleAddFamilyRelationship(newPersonId);
      
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
        await api.post('/relationships', {
          person1_id: person.person_id,
          person2_id: targetPersonId,
          relationship_type: 'spouse',
        });
      } else {
        // parent-child relationship
        const parentId = familyRelType === 'parent' ? targetPersonId : person.person_id;
        const childId = familyRelType === 'parent' ? person.person_id : targetPersonId;
        await api.post('/relationships', {
          person1_id: parentId,
          person2_id: childId,
          relationship_type: 'parent',
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
      await api.delete(`/relationships/${relationshipId}`);
      
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
      await api.put(`/relationships/${editingSpouseRel.relationship_id}`, {
        notes: editingMaritalStatus,
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
      await api.delete(`/persons/${person.person_id}`);

      // Redirect to family tree
      navigate(`/family/${person.family_id}/tree`);
    } catch (error) {
      console.error('Failed to delete person:', error);
      setSnackbar({ open: true, message: `Failed to delete family member: ${error.response?.data?.error || error.message}. Please make sure you have permission to delete this person.`, severity: 'error' });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ bgcolor: '#FBF7F0', minHeight: '100vh' }}>
        <Box sx={{ px: { xs: 3, md: 5 }, py: 5 }}>
          <PersonDetailSkeleton />
        </Box>
      </Box>
    );
  }

  if (!person) {
    return (
      <Box sx={{ bgcolor: '#FBF7F0', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" sx={{ fontFamily: "'Fraunces', serif", mb: 1 }}>Person not found</Typography>
          <Button onClick={() => navigate(-1)} sx={{ color: '#22345E' }}>← Go back</Button>
        </Box>
      </Box>
    );
  }

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0 || !parts[0]) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try { return new Date(dateStr).toLocaleDateString(); } catch { return dateStr; }
  };

  const lifeDates = [
    person.date_of_birth && `b. ${formatDate(person.date_of_birth)}`,
    person.date_of_death && `d. ${formatDate(person.date_of_death)}`,
  ].filter(Boolean).join(' · ');

  return (
    <Box sx={{ bgcolor: '#FBF7F0', minHeight: '100vh' }}>
      {/* Top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 3, md: 4.5 }, py: 2, bgcolor: '#FFFFFF', borderBottom: '1px solid #E7DCC8' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17 }}>
          <svg viewBox="0 0 200 200" width="28" height="28">
            <rect width="200" height="200" rx="44" fill="#22345E" />
            <line x1="100" y1="150" x2="70" y2="176" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
            <line x1="100" y1="150" x2="100" y2="180" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
            <line x1="100" y1="150" x2="130" y2="176" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
            <line x1="100" y1="150" x2="100" y2="108" stroke="#F1E6D2" strokeWidth="5" strokeLinecap="round" />
            <line x1="100" y1="120" x2="62" y2="90" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
            <line x1="100" y1="120" x2="100" y2="72" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
            <line x1="100" y1="120" x2="138" y2="90" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
            <circle cx="100" cy="66" r="11" fill="#D79A1E" />
            <circle cx="62" cy="90" r="8" fill="#3F6644" />
            <circle cx="138" cy="90" r="8" fill="#3F6644" />
          </svg>
          Family Tree
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button size="small" startIcon={<PdfIcon />} onClick={async () => {
            try {
              setSnackbar({ open: true, message: 'Generating PDF with photo...', severity: 'info' });
              await exportPersonProfileToPDF(person, { parents, children, spouses, siblings });
              setSnackbar({ open: true, message: 'PDF exported successfully!', severity: 'success' });
            } catch (error) {
              console.error('Failed to export PDF:', error);
              setSnackbar({ open: true, message: 'Failed to export PDF. Please try again.', severity: 'error' });
            }
          }} sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }} variant="outlined">
            Export PDF
          </Button>
          <Button size="small" startIcon={<PendingActionsIcon />} onClick={() => setPendingChangesOpen(true)} sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }} variant="outlined">
            Pending
          </Button>
          <Button size="small" startIcon={<HistoryIcon />} onClick={() => setEditHistoryOpen(true)} sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }} variant="outlined">
            History
          </Button>
          <Button
            size="small"
            startIcon={<AutoAwesomeIcon />}
            onClick={() => navigate(`/person/${person.person_id}/wisdom-chat`)}
            sx={{
              borderColor: '#EAEEF6',
              color: '#22345E',
              textTransform: 'none',
              background: 'linear-gradient(135deg, #FFFFFF 0%, #FBEFD6 100%)',
              '&:hover': { background: 'linear-gradient(135deg, #FFFFFF 0%, #F7E5D8 100%)' },
            }}
            variant="outlined"
          >
            Wisdom Chat
          </Button>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#22345E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12.5px', fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
            {user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'}
          </Box>
        </Box>
      </Box>

      {/* Main content */}
      <Box sx={{ px: { xs: 3, md: 5 }, py: { xs: 3, md: 4.5 }, maxWidth: 1140, mx: 'auto' }}>
        <Button onClick={() => navigate(-1)} sx={{ color: '#22345E', fontWeight: 600, textTransform: 'none', fontSize: 13, mb: 2.5, display: 'inline-flex', gap: 0.75, alignItems: 'center' }}>
          ← Back to tree
        </Button>
        <Grid container spacing={3.5}>
          {/* Left column — Profile card */}
          <Grid item xs={12} md={4}>
            <Box sx={{
              bgcolor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden',
              border: '1px solid #E7DCC8', position: 'sticky', top: 24,
              boxShadow: '0 12px 28px rgba(28,20,16,.06)',
            }}>

              {/* Avatar area */}
              <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mx: -3, mt: -3, overflow: 'hidden' }}>
                <Box sx={{
                  width: '100%', aspectRatio: '1 / 1',
                  bgcolor: '#22345E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', position: 'relative',
                }}>
                  {person.profile_photo_url ? (
                    <Box component="img" src={person.profile_photo_url} alt={person.full_name}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Typography sx={{ fontFamily: "'Fraunces', serif", fontSize: 54, fontWeight: 600, color: '#fff' }}>
                      {getInitials(person.full_name)}
                    </Typography>
                  )}
                  {canEdit && (
                    <>
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
                            const compressedFile = await compressImage(file, 1920, 1920, 0.8);
                            const formData = new FormData();
                            formData.append('photo', compressedFile);
                            const res = await api.post(`/persons/${person.person_id}/profile-photo`, formData, {
                              headers: { 'Content-Type': 'multipart/form-data' },
                            });
                            const photoUrl = res.data.person.profile_photo_url;
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
                      <label htmlFor="profile-picture-upload" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
                        <Box sx={{
                          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: 'rgba(34, 52, 94, 0.4)', opacity: 0,
                          transition: 'opacity 0.2s ease', cursor: 'pointer',
                          '&:hover': { opacity: 1 },
                        }}>
                          <Box sx={{ textAlign: 'center', color: '#fff' }}>
                            <PhotoCameraIcon sx={{ fontSize: 40, mb: 1 }} />
                            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>Change Photo</Typography>
                          </Box>
                        </Box>
                        <IconButton component="span" sx={{
                          position: 'absolute', bottom: 12, right: 12,
                          bgcolor: '#D79A1E', color: '#fff', border: '2px solid #fff',
                          width: 42, height: 42, 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          '&:hover': { bgcolor: '#C58D1B' },
                          zIndex: 2
                        }} disabled={uploadingProfilePicture}>
                          {uploadingProfilePicture ? <CircularProgress size={20} color="inherit" /> : <PhotoCameraIcon sx={{ fontSize: 22 }} />}
                        </IconButton>
                      </label>
                    </>
                  )}
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 3, mb: 0.25, mt: 3 }}>
                  <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 21 }}>
                    {person.full_name}
                  </Typography>
                  {person.verified_by_elder && (
                    <Box sx={{
                      width: 18, height: 18, borderRadius: '50%', bgcolor: '#3F6644', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <CheckCircleIcon sx={{ fontSize: 10 }} />
                    </Box>
                  )}
                </Box>
                {(lifeDates || person.place_of_birth) && (
                  <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: '#8C8171', px: 3, mb: 2.25 }}>
                    {[lifeDates, person.place_of_birth].filter(Boolean).join(' · ')}
                  </Typography>
                )}

                {/* Action buttons */}
                {canEdit && (
                  <Box sx={{ display: 'flex', gap: 1, px: 3, mt: 1.5, mb: 2.25, flexWrap: 'wrap', width: '100%' }}>
                    <Button size="small" variant="outlined" onClick={openEdit} sx={{ flex: 1, borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none', fontSize: 12.5, py: 0.75 }}>
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PdfIcon />}
                      onClick={async () => {
                        try {
                          setSnackbar({ open: true, message: 'Generating PDF with photo...', severity: 'info' });
                          await exportPersonProfileToPDF(person, { parents, children, spouses, siblings });
                          setSnackbar({ open: true, message: 'PDF exported successfully!', severity: 'success' });
                        } catch (error) {
                          console.error('Failed to export PDF:', error);
                          setSnackbar({ open: true, message: 'Failed to export PDF. Please try again.', severity: 'error' });
                        }
                      }}
                      sx={{ flex: 1, borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none', fontSize: 12.5, py: 0.75 }}
                    >
                      Export PDF
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<EmailIcon />} onClick={() => setInviteDialogOpen(true)} disabled={!!person.owner_user_id} sx={{ flex: 1, borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none', fontSize: 12.5, py: 0.75 }}>
                      Invite
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<CheckCircleIcon />} onClick={() => setSnackbar({ open: true, message: 'Elder verification feature coming soon', severity: 'info' })} sx={{ flex: 1, borderColor: '#EAEEF6', color: '#3F6644', textTransform: 'none', fontSize: 12.5, py: 0.75 }}>
                      Verify
                    </Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteDialogOpen(true)} sx={{ flex: 1, borderColor: '#EAEEF6', color: '#C1622D', textTransform: 'none', fontSize: 12.5, py: 0.75 }}>
                      Delete
                    </Button>
                  </Box>
                )}
              </Box>

              {/* Info rows */}
              <Box sx={{ p: 3, pt: 0 }}>
                {[
                  { label: 'Gender', value: person.gender ? (person.gender.charAt(0).toUpperCase() + person.gender.slice(1)) : null },
                  { label: 'Clan', value: person.clan_name },
                  { label: 'Village', value: person.village_origin },
                  { label: 'Occupation', value: person.occupation },
                  { label: 'Status', value: person.alive_status ? 'Living' : 'Deceased' },
                ].filter(row => row.value).map((row, i, arr) => (
                  <Box key={i} sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    py: 1.125, borderBottom: i < arr.length - 1 ? '1px solid' : 'none', borderColor: '#F3ECE0',
                  }}>
                    <Typography sx={{ fontSize: 13, color: '#8C8171' }}>{row.label}</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}>{row.value}</Typography>
                  </Box>
                ))}

                {/* Relationship to you */}
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C8171', mb: 1 }}>
                    Your relationship
                  </Typography>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={selfRelation?.relationship_to_self || ''}
                    onChange={handleRelationChange}
                    disabled={relationSaving}
                    sx={{ '& .MuiSelect-select': { fontSize: '13px' } }}
                  >
                    <MenuItem value=""><em>Not set</em></MenuItem>
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
              </Box>
            </Box>
          </Grid>

          {/* Right column — Tabs content */}
          <Grid item xs={12} md={8}>
            {/* Tab bar */}
            <Box sx={{ display: 'flex', gap: 0.5, borderBottom: '1px solid #E7DCC8', mb: 2.75 }}>
              {['Overview', 'Documents', 'Stories', 'Edit history'].map((tab) => (
                <Box key={tab} onClick={() => setActiveTab(tab.toLowerCase().replace(' ', '_'))}
                  sx={{
                    px: 0.5, py: 1.25, mr: 3.25, cursor: 'pointer',
                    fontSize: '13.5px', fontWeight: 600,
                    color: activeTab === tab.toLowerCase().replace(' ', '_') ? '#1C1410' : '#8C8171',
                    borderBottom: activeTab === tab.toLowerCase().replace(' ', '_') ? '2px solid #D79A1E' : '2px solid transparent',
                    marginBottom: '-1px', transition: 'color 0.15s',
                    '&:hover': { color: '#1C1410' },
                  }}
                >
                  {tab}
                </Box>
              ))}
            </Box>

            {/* Overview tab */}
            {activeTab === 'overview' && (
              <Box>
                {/* Biography */}
                {person.biography && (
                  <Box sx={{
                    bgcolor: '#FFFFFF', borderRadius: '16px', p: '22px 24px',
                    border: '1px solid #E7DCC8', mb: 3,
                  }}>
                    <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C8171', mb: 1.25 }}>
                      Biography
                    </Typography>
                    <Typography sx={{ fontSize: 14, lineHeight: 1.7, color: '#5C5346' }}>
                      {person.biography}
                    </Typography>
                  </Box>
                )}

                {/* Family relationships */}
                <Box sx={{
                  bgcolor: '#FFFFFF', borderRadius: '16px', p: '22px 24px',
                  border: '1px solid #E7DCC8',
                }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>
                      Family relationships
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => { setFamilyRelType('parent'); setSelectedFamilyPersonId(''); setAddFamilyOpen(true); }}
                      sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none', fontSize: 12 }}>
                      + Add family
                    </Button>
                  </Box>

                  {/* Parents */}
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C8171', mb: 1.5 }}>
                      Parents
                    </Typography>
                    {parents.length === 0 ? (
                      <Typography sx={{ fontSize: '13px', color: '#8C8171' }}>No parents linked yet.</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {parents.filter(p => p && p.person_id).map((p) => {
                          let roleLabel = 'Parent';
                          if (p.gender === 'male') roleLabel = 'Father';
                          if (p.gender === 'female') roleLabel = 'Mother';
                          return (
                            <Box key={p.person_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.125, bgcolor: '#FFFFFF', border: '1px solid #E7DCC8', borderRadius: '12px', px: 1.125, py: 1.125, cursor: 'pointer', transition: 'transform .15s ease, box-shadow .15s ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 18px rgba(28,20,16,.08)' } }}
                              onClick={() => navigate(`/person/${p.person_id}`)}
                            >
                              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: '#22345E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                                {getInitials(p.full_name)}
                              </Box>
                              <Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.full_name || 'Unknown Parent'}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace" }}>{roleLabel}</Typography>
                              </Box>
                              {canEdit && p.relationship_id && (
                                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteRelationship(p.relationship_id, 'parent'); }} sx={{ ml: 0.5, p: 0.25 }}>
                                  <DeleteIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>

                  {/* Spouses */}
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C8171', mb: 1.5 }}>
                      Spouses
                    </Typography>
                    {spouses.length === 0 ? (
                      <Typography sx={{ fontSize: '13px', color: '#8C8171' }}>No spouses linked yet.</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {spouses.filter(s => s && s.person_id).map((s) => {
                          const statusLabels = { married: 'Married', divorced: 'Divorced', widowed: 'Widowed', separated: 'Separated' };
                          const marital = s.marital_status || 'married';
                          return (
                            <Box key={s.person_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.125, bgcolor: '#FFFFFF', border: '1px solid #E7DCC8', borderRadius: '4px 12px 12px 4px', borderLeft: '3px solid #D79A1E', px: 1.125, py: 1.125, cursor: 'pointer', transition: 'transform .15s ease, box-shadow .15s ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 18px rgba(28,20,16,.08)' } }}
                              onClick={() => navigate(`/person/${s.person_id}`)}
                            >
                              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: '#D79A1E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                                {getInitials(s.full_name)}
                              </Box>
                              <Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s.full_name}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace" }}>{statusLabels[marital] || 'Married'}</Typography>
                              </Box>
                              {canEdit && s.relationship_id && (
                                <>
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleEditMaritalStatus(s); }} sx={{ p: 0.25, color: '#22345E' }}>
                                    <EditIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteRelationship(s.relationship_id, 'spouse'); }} sx={{ p: 0.25 }}>
                                    <DeleteIcon sx={{ fontSize: 14 }} />
                                  </IconButton>
                                </>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>

                  {/* Children */}
                  <Box sx={{ mb: 2.5 }}>
                    <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C8171', mb: 1.5 }}>
                      Children
                    </Typography>
                    {children.length === 0 ? (
                      <Typography sx={{ fontSize: '13px', color: '#8C8171' }}>No children linked yet.</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {children.filter(c => c && c.person_id).map((c) => (
                          <Box key={c.person_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.125, bgcolor: '#FFFFFF', border: '1px solid #E7DCC8', borderRadius: '12px', px: 1.125, py: 1.125, cursor: 'pointer', transition: 'transform .15s ease, box-shadow .15s ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 18px rgba(28,20,16,.08)' } }}
                            onClick={() => navigate(`/person/${c.person_id}`)}
                          >
                            <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: '#3F6644', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                              {getInitials(c.full_name)}
                            </Box>
                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{c.full_name}</Typography>
                            {canEdit && c.relationship_id && (
                              <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); handleDeleteRelationship(c.relationship_id, 'child'); }} sx={{ p: 0.25 }}>
                                <DeleteIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            )}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>

                  {/* Siblings */}
                  <Box>
                    <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C8171', mb: 1.5 }}>
                      Siblings
                    </Typography>
                    {siblings.length === 0 ? (
                      <Typography sx={{ fontSize: '13px', color: '#8C8171' }}>No siblings linked yet.</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                        {siblings.filter(s => s && s.person_id).map((s) => {
                          let roleLabel = 'Sibling';
                          if (s.gender === 'male') roleLabel = 'Brother';
                          if (s.gender === 'female') roleLabel = 'Sister';
                          return (
                            <Box key={s.person_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.125, bgcolor: '#FFFFFF', border: '1px solid #E7DCC8', borderRadius: '12px', px: 1.125, py: 1.125, cursor: 'pointer', transition: 'transform .15s ease, box-shadow .15s ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 18px rgba(28,20,16,.08)' } }}
                              onClick={() => navigate(`/person/${s.person_id}`)}
                            >
                              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: '#3A4F82', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                                {getInitials(s.full_name)}
                              </Box>
                              <Box>
                                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{s.full_name}</Typography>
                                <Typography sx={{ fontSize: 11, color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace" }}>{roleLabel}</Typography>
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            )}

            {/* Documents tab */}
            {activeTab === 'documents' && (
              <Box sx={{
                bgcolor: '#FFFFFF', borderRadius: '16px', p: '22px 24px',
                border: '1px solid #E7DCC8',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>
                    Documents & Photos
                  </Typography>
                  {canEdit && (
                    <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => setUploadDialogOpen(true)}
                      sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none', fontSize: 12 }}>
                      Upload
                    </Button>
                  )}
                </Box>
                {documents.length === 0 ? (
                  <Typography sx={{ fontSize: '13px', color: '#8C8171' }}>
                    No documents or photos yet. {canEdit && 'Click "Upload" to add photos or documents.'}
                  </Typography>
                ) : (
                  <Grid container spacing={1.5}>
                    {documents.map((doc) => (
                      <Grid item xs={6} sm={4} md={3} key={doc.document_id}>
                        <Box sx={{
                          aspectRatio: '3 / 4', borderRadius: '10px', overflow: 'hidden',
                          border: '1px solid #E7DCC8', position: 'relative',
                          cursor: 'pointer', transition: 'transform .15s ease', '&:hover': { transform: 'translateY(-3px)' },
                          display: 'flex', flexDirection: 'column',
                        }} onClick={() => window.open(doc.file_url, '_blank')}>
                          {doc.document_type === 'photo' ? (
                            <Box component="img" src={doc.file_url} alt={doc.title || 'Photo'}
                              sx={{ width: '100%', flex: 1, objectFit: 'cover' }}
                            />
                          ) : (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F3ECE0' }}>
                              <Typography sx={{ fontSize: 20, color: '#8C8171' }}>
                                {doc.document_type === 'certificate' ? '📜' : doc.document_type === 'audio' ? '🎵' : doc.document_type === 'video' ? '🎬' : '📄'}
                              </Typography>
                            </Box>
                          )}
                          <Box sx={{ p: 1, bgcolor: '#FFFFFF' }}>
                            <Typography sx={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {doc.title || 'Untitled'}
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace" }}>
                              {doc.document_type}
                            </Typography>
                          </Box>
                          {canEdit && (
                            <IconButton size="small" color="error" sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'rgba(255,255,255,0.9)' }}
                              onClick={async () => {
                                if (window.confirm('Delete this document?')) {
                                  try {
                                    await api.delete(`/documents/${doc.document_id}`);
                                    await fetchDocuments(person.person_id, person.family_id);
                                  } catch (error) {
                                    console.error('Failed to delete document:', error);
                                    setSnackbar({ open: true, message: 'Failed to delete document', severity: 'error' });
                                  }
                                }
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          )}
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            )}

            {/* Stories tab */}
            {activeTab === 'stories' && (
              <Box sx={{
                bgcolor: '#FFFFFF', borderRadius: '16px', p: '22px 24px',
                border: '1px solid #E7DCC8',
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                  <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16 }}>
                    Stories & Oral History
                  </Typography>
                  {canEdit && (
                    <Button size="small" variant="outlined" startIcon={<BookIcon />} onClick={() => setStoryDialogOpen(true)}
                      sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none', fontSize: 12 }}>
                      Add story
                    </Button>
                  )}
                </Box>
                {stories.length === 0 ? (
                  <Typography sx={{ fontSize: '13px', color: '#8C8171' }}>
                    No stories yet. {canEdit && 'Click "Add story" to preserve oral history and family stories.'}
                  </Typography>
                ) : (
                  <Box>
                    {stories.map((story) => (
                      <Box key={story.story_id} sx={{
                        mb: 1.5, p: '18px 18px 18px 24px', borderRadius: '12px',
                        bgcolor: '#FBF7F0', border: '1px solid #E7DCC8',
                        position: 'relative',
                        '&::before': { content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: '5px', bgcolor: '#3F6644', borderRadius: '12px 0 0 12px' },
                      }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15 }}>
                            {story.title || 'Untitled Story'}
                          </Typography>
                          {canEdit && (
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <IconButton size="small" color="primary" onClick={() => {
                                setEditingStoryId(story.story_id);
                                setStoryTitle(story.title || '');
                                setStoryContent(story.story_text || '');
                                setStoryNarrator(story.narrator_name || '');
                                setStoryDate(story.recorded_date || '');
                                setStoryLocation(story.location || '');
                                setStoryTags(story.tags ? story.tags.join(', ') : '');
                                setStoryAudioFile(null);
                                setStoryDialogOpen(true);
                              }}>
                                <EditIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                              <IconButton size="small" color="error" onClick={async () => {
                                if (window.confirm('Delete this story?')) {
                                  try {
                                    await api.delete(`/stories/${story.story_id}`);
                                    await fetchStories(person.person_id, person.family_id);
                                    setSnackbar({ open: true, message: 'Story deleted successfully', severity: 'success' });
                                  } catch (error) {
                                    console.error('Failed to delete story:', error);
                                    setSnackbar({ open: true, message: 'Failed to delete story', severity: 'error' });
                                  }
                                }
                              }}>
                                <DeleteIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                        {story.narrator_name && (
                          <Typography sx={{ fontSize: '12px', color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace", mb: 0.75 }}>
                            Narrator: {story.narrator_name}
                          </Typography>
                        )}
                        {(story.recorded_date || story.location) && (
                          <Typography sx={{ fontSize: '12px', color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace", mb: 0.75 }}>
                            {story.recorded_date && formatDate(story.recorded_date)}
                            {story.recorded_date && story.location && ' · '}
                            {story.location}
                          </Typography>
                        )}
                        <Typography sx={{ fontSize: 14, lineHeight: 1.7, color: '#5C5346', mt: 1, whiteSpace: 'pre-wrap' }}>
                          {story.story_text}
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
                          <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                            {story.tags.map((tag, idx) => (
                              <Box key={idx} sx={{
                                fontSize: '11px', fontFamily: "'IBM Plex Mono', monospace",
                                px: 1, py: 0.375, borderRadius: '20px',
                                bgcolor: '#EAEEF6', color: '#22345E',
                              }}>
                                {tag}
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )}

            {/* Edit history tab */}
            {activeTab === 'edit_history' && (
              <Box sx={{
                bgcolor: '#FFFFFF', borderRadius: '16px', p: '22px 24px',
                border: '1px solid #E7DCC8',
                textAlign: 'center',
              }}>
                <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, mb: 1 }}>
                  Edit history
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#8C8171', mb: 2 }}>
                  View all changes made to this person's profile over time.
                </Typography>
                <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setEditHistoryOpen(true)}
                  sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }}>
                  Open edit history
                </Button>
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>

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
                // Parse tags
                const tagsArray = storyTags
                  ? storyTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
                  : [];

                if (editingStoryId) {
                  // Update existing story
                  const updateData = {
                    title: storyTitle || null,
                    story_text: storyContent,
                    narrator_name: storyNarrator || null,
                    recorded_date: storyDate || null,
                    location: storyLocation || null,
                    tags: tagsArray,
                  };
                  await api.put(`/stories/${editingStoryId}`, updateData);
                  setSnackbar({ open: true, message: 'Story updated successfully', severity: 'success' });
                } else {
                  // Create new story - use multipart form data if audio file is present
                  if (storyAudioFile) {
                    const formData = new FormData();
                    formData.append('person_id', person.person_id);
                    formData.append('family_id', person.family_id);
                    formData.append('title', storyTitle || '');
                    formData.append('story_text', storyContent);
                    formData.append('narrator_name', storyNarrator || '');
                    formData.append('recorded_date', storyDate || '');
                    formData.append('location', storyLocation || '');
                    formData.append('tags', JSON.stringify(tagsArray));
                    formData.append('audio', storyAudioFile);
                    await api.post('/stories', formData, {
                      headers: { 'Content-Type': 'multipart/form-data' },
                    });
                  } else {
                    await api.post('/stories', {
                      person_id: person.person_id,
                      family_id: person.family_id,
                      title: storyTitle || null,
                      story_text: storyContent,
                      narrator_name: storyNarrator || null,
                      recorded_date: storyDate || null,
                      location: storyLocation || null,
                      tags: tagsArray,
                    });
                  }
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
      <Dialog open={addFamilyOpen} onClose={() => setAddFamilyOpen(false)} fullWidth maxWidth="sm">
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
                    await api.post(`/families/${person.family_id}/invite`, {
                      email: inviteEmail.trim().toLowerCase(),
                      person_id: person.person_id,
                      person_name: person.full_name,
                    });

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
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} fullWidth maxWidth="sm">
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

                const formData = new FormData();
                formData.append('person_id', person.person_id);
                formData.append('family_id', person.family_id);
                formData.append('document_type', uploadType);
                formData.append('title', uploadTitle || uploadFile.name);
                if (uploadDescription) {
                  formData.append('description', uploadDescription);
                }
                formData.append('file', fileToUpload);

                await api.post('/documents/upload', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' },
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
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
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
      <Dialog open={editMaritalStatusOpen} onClose={() => setEditMaritalStatusOpen(false)} fullWidth maxWidth="sm">
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

      {/* Pending Changes Dialog */}
      <PendingChangesDialog
        person={person}
        open={pendingChangesOpen}
        onClose={() => setPendingChangesOpen(false)}
        currentUser={user}
        onChangesResolved={async () => {
          // Refresh person data after changes are resolved
          await fetchPersonDetails();
        }}
      />

      {/* Edit History Dialog */}
      <EditHistoryDialog
        person={person}
        open={editHistoryOpen}
        onClose={() => setEditHistoryOpen(false)}
      />

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
    </Box>
  );
};

export default PersonDetail;

