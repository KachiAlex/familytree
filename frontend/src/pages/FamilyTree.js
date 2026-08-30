import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  InputAdornment,
  Autocomplete,
  Menu,
  MenuItem,
  Snackbar,
  Alert,
  Skeleton,
  Collapse,
  Paper,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  FileDownload as FileDownloadIcon,
  PictureAsPdf as PdfIcon,
  Upload as UploadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import api from '../services/api';
import { exportFamilyTreeToPDF } from '../utils/pdfExport';
import { exportGEDCOM, parseGEDCOM } from '../utils/gedcomExport';
import { useAuth } from '../contexts/AuthContext';
import { isProfileComplete } from '../utils/profileUtils';
import VerticalTreeView from '../components/TreeViews/VerticalTreeView';
import HorizontalTreeView from '../components/TreeViews/HorizontalTreeView';
import RadialTreeView from '../components/TreeViews/RadialTreeView';
import ThreeDTreeView from '../components/TreeViews/ThreeDTreeView';
import TimelineView from '../components/TreeViews/TimelineView';
import MigrationMapView from '../components/TreeViews/MigrationMapView';
import { FamilyTreeSkeleton } from '../components/SkeletonLoaders';
import GedcomImportPreview from '../components/GedcomImportPreview';

const FamilyTree = () => {
  const { familyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [treeData, setTreeData] = useState(null);
  const [filteredTreeData, setFilteredTreeData] = useState(null);
  const [viewType, setViewType] = useState('vertical');
  const [loading, setLoading] = useState(true);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clanFilter, setClanFilter] = useState('');
  const [villageFilter, setVillageFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [familyInfo, setFamilyInfo] = useState(null);
  const [focalPersonId, setFocalPersonId] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [gedcomImportOpen, setGedcomImportOpen] = useState(false);
  const [gedcomPreviewOpen, setGedcomPreviewOpen] = useState(false);
  const [importingGedcom, setImportingGedcom] = useState(false);
  const [parsedGedcomData, setParsedGedcomData] = useState(null);
  const [existingPersons, setExistingPersons] = useState([]);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [searchFiltersExpanded, setSearchFiltersExpanded] = useState(false); // Default to collapsed
  const [relationshipAnchor, setRelationshipAnchor] = useState(null);
  const [relationshipPerson1, setRelationshipPerson1] = useState(null);
  const [relationshipPerson2, setRelationshipPerson2] = useState(null);
  const [calculatedRelationship, setRelationship] = useState(null);
  const [selectedPersonForStory, setSelectedPersonForStory] = useState(null);
  const treeContainerRef = useRef(null); // Ref for tree container to capture visualization

  // Only fetch when familyId changes, not when viewType changes
  useEffect(() => {
    fetchTreeData();
    fetchFamilyInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const fetchFamilyInfo = async () => {
    try {
      const res = await api.get(`/families/${familyId}`);
      if (res.data.family) {
        setFamilyInfo(res.data.family);
      }
    } catch (error) {
      console.error('Failed to fetch family info:', error);
    }
  };

  const fetchTreeData = async () => {
    try {
      setLoading(true);

      const res = await api.get(`/tree/family/${familyId}`);
      const { nodes: apiNodes, edges: apiEdges } = res.data;

      const persons = apiNodes.map((n) => n.data);

      const nodes = apiNodes.map((n) => ({
        id: n.id,
        data: {
          ...n.data,
          person_id: n.id,
          label: n.data.full_name,
        },
      }));

      // Map backend edges to frontend format
      // Backend: person1_id=parent, person2_id=child for 'parent' type
      // Backend: person1_id/person2_id for 'spouse' type
      const edges = apiEdges.map((e) => {
        if (e.type === 'parent') {
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'parent',
            verified: e.verified || false,
            label: 'parent',
          };
        } else if (e.type === 'spouse') {
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'spouse',
            verified: e.verified || false,
            label: 'spouse',
            marital_status: 'married',
          };
        }
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          verified: e.verified || false,
          label: e.type,
        };
      });

      const parentEdges = edges.filter((e) => e.type === 'parent');
      const hasParent = new Set(parentEdges.map((e) => String(e.target)));
      const rootNodes = nodes.filter((n) => !hasParent.has(String(n.id))).map((n) => n.id);

      const data = {
        nodes,
        edges,
        rootNodes,
      };
      setTreeData(data);
      setFilteredTreeData(data);
      
      // Set initial focal person to the first root node if not already set
      if (!focalPersonId && rootNodes.length > 0) {
        setFocalPersonId(String(rootNodes[0]));
      }

      // Compute statistics
      const total = persons.length;
      const maleCount = persons.filter((p) => p.gender === 'male').length;
      const femaleCount = persons.filter((p) => p.gender === 'female').length;
      const otherCount = total - maleCount - femaleCount;
      const clanCounts = {};
      const villageCounts = {};
      const occupationCounts = {};
      persons.forEach((p) => {
        if (p.clan_name) {
          clanCounts[p.clan_name] = (clanCounts[p.clan_name] || 0) + 1;
        }
        if (p.village_origin) {
          villageCounts[p.village_origin] = (villageCounts[p.village_origin] || 0) + 1;
        }
        if (p.occupation) {
          occupationCounts[p.occupation] = (occupationCounts[p.occupation] || 0) + 1;
        }
      });
      setStats({
        total,
        maleCount,
        femaleCount,
        otherCount,
        clanCounts,
        villageCounts,
        occupationCounts,
      });
    } catch (error) {
      console.error('Failed to fetch tree data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Derive filter options
  const clanOptions = useMemo(() => {
    if (!treeData) return [];
    const set = new Set(
      treeData.nodes
        .map((node) => node.data.clan_name)
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [treeData]);

  const villageOptions = useMemo(() => {
    if (!treeData) return [];
    const set = new Set(
      treeData.nodes
        .map((node) => node.data.village_origin)
        .filter(Boolean)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [treeData]);

  // Filter tree data based on search and filters
  useEffect(() => {
    if (!treeData) {
      setFilteredTreeData(treeData);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filteredNodes = treeData.nodes.filter((node) => {
      const person = node.data;
      const matchesSearch =
        !query ||
        person.full_name?.toLowerCase().includes(query) ||
        person.clan_name?.toLowerCase().includes(query) ||
        person.village_origin?.toLowerCase().includes(query) ||
        person.place_of_birth?.toLowerCase().includes(query) ||
        person.occupation?.toLowerCase().includes(query);

      const matchesClan = !clanFilter || person.clan_name === clanFilter;
      const matchesVillage = !villageFilter || person.village_origin === villageFilter;

      return matchesSearch && matchesClan && matchesVillage;
    });

    const filteredNodeIds = new Set(filteredNodes.map((n) => String(n.id)));

    // Include edges that connect filtered nodes
    const filteredEdges = treeData.edges.filter(
      (edge) => filteredNodeIds.has(String(edge.source)) && filteredNodeIds.has(String(edge.target))
    );

    // Find root nodes from filtered nodes
    const hasParent = new Set(
      filteredEdges.filter((e) => e.type === 'parent').map((e) => String(e.target))
    );
    const filteredRootNodes = filteredNodes
      .filter((n) => !hasParent.has(String(n.id)))
      .map((n) => n.id);

    setFilteredTreeData({
      nodes: filteredNodes,
      edges: filteredEdges,
      rootNodes: filteredRootNodes,
    });
  }, [searchQuery, clanFilter, villageFilter, treeData]);

  // Memoize the tree data with current viewType and focal person
  const treeDataWithView = useMemo(() => {
    if (!filteredTreeData) return null;
    return { 
      ...filteredTreeData, 
      viewType, 
      focalPersonId 
    };
  }, [filteredTreeData, viewType, focalPersonId]);

  const handleViewChange = useCallback((event, newValue) => {
    setViewType(newValue);
  }, []);

  const calculateRelationship = useCallback((p1, p2) => {
    if (!p1 || !p2 || !treeData) return null;
    if (p1.id === p2.id) return "Same person";

    // Build adjacency list for traversal
    const adj = new Map();
    treeData.edges.forEach(e => {
      const src = String(e.source);
      const tgt = String(e.target);
      if (!adj.has(src)) adj.set(src, []);
      if (!adj.has(tgt)) adj.set(tgt, []);
      adj.get(src).push({ id: tgt, type: e.type, direction: 'down' });
      adj.get(tgt).push({ id: src, type: e.type, direction: 'up' });
    });

    // BFS to find path
    const queue = [[String(p1.id), []]];
    const visited = new Set([String(p1.id)]);
    
    while (queue.length > 0) {
      const [currId, path] = queue.shift();
      if (currId === String(p2.id)) {
        // Analyze path to determine relationship name
        // This is a simplified version; real genealogy logic is complex
        const upCount = path.filter(step => step.direction === 'up' && step.type === 'parent').length;
        const downCount = path.filter(step => step.direction === 'down' && step.type === 'parent').length;
        const spouseCount = path.filter(step => step.type === 'spouse').length;

        if (spouseCount > 0 && path.length === 1) return "Spouse";
        if (upCount === 1 && downCount === 0) return "Parent";
        if (upCount === 0 && downCount === 1) return "Child";
        if (upCount === 2 && downCount === 0) return "Grandparent";
        if (upCount === 0 && downCount === 2) return "Grandchild";
        if (upCount === 1 && downCount === 1) return "Sibling";
        if (upCount === 2 && downCount === 1) return "Uncle/Aunt";
        if (upCount === 1 && downCount === 2) return "Nephew/Niece";
        if (upCount === 2 && downCount === 2) return "First Cousin";
        
        return `${upCount} generations up, ${downCount} generations down`;
      }

      const neighbors = adj.get(currId) || [];
      neighbors.forEach(n => {
        if (!visited.has(n.id)) {
          visited.add(n.id);
          queue.push([n.id, [...path, n]]);
        }
      });
    }

    return "No direct path found";
  }, [treeData]);

  useEffect(() => {
    if (relationshipPerson1 && relationshipPerson2) {
      setRelationship(calculateRelationship(relationshipPerson1, relationshipPerson2));
    } else {
      setRelationship(null);
    }
  }, [relationshipPerson1, relationshipPerson2, calculateRelationship]);

  const handlePersonClick = useCallback((personId) => {
    if (!personId) return;
    const node = treeData?.nodes.find(n => String(n.id) === String(personId));
    if (node) {
      setSelectedPersonForStory(node.data);
    }
  }, [treeData]);

  const handleAddPersonClick = useCallback(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    // Check if profile is complete
    const profileStatus = isProfileComplete(user);
    if (!profileStatus.isComplete) {
      setProfileDialogOpen(true);
      return;
    }

    // Profile is complete, proceed to add person
    navigate(`/family/${familyId}/add-person`);
  }, [user, navigate, familyId]);

  const renderTreeView = useMemo(() => {
    if (!treeDataWithView) {
      return (
        <Box sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2, mb: 2 }} />
          <Skeleton variant="rectangular" height={320} sx={{ borderRadius: 2 }} />
        </Box>
      );
    }

    if (loading) {
      return <FamilyTreeSkeleton />;
    }

    // Show empty state if search returned no results
    if (filteredTreeData && filteredTreeData.nodes.length === 0 && searchQuery) {
      return (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No persons found matching "{searchQuery}"
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try searching by name, clan, village, or occupation
          </Typography>
        </Box>
      );
    }

    switch (viewType) {
      case 'vertical':
        return <VerticalTreeView data={treeDataWithView} onPersonClick={handlePersonClick} onSetFocalPerson={setFocalPersonId} />;
      case 'horizontal':
        return <HorizontalTreeView data={treeDataWithView} onPersonClick={handlePersonClick} onSetFocalPerson={setFocalPersonId} />;
      case 'radial':
        return <RadialTreeView data={treeDataWithView} onPersonClick={handlePersonClick} onSetFocalPerson={setFocalPersonId} />;
      case '3d':
        return <ThreeDTreeView data={treeDataWithView} onPersonClick={handlePersonClick} onSetFocalPerson={setFocalPersonId} />;
      case 'timeline':
        return <TimelineView familyId={familyId} />;
      case 'map':
        return <MigrationMapView familyId={familyId} />;
      default:
        return <VerticalTreeView data={treeDataWithView} onPersonClick={handlePersonClick} />;
    }
  }, [loading, treeDataWithView, viewType, handlePersonClick, familyId, filteredTreeData, searchQuery]);

  const handleExport = useCallback(
    async (format) => {
      if (!filteredTreeData) return;
      const data = filteredTreeData.nodes.map((node) => node.data);
      try {
        if (format === 'json') {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `family_${familyId}_export.json`;
          link.click();
          URL.revokeObjectURL(url);
        } else if (format === 'csv') {
          const headers = ['full_name', 'gender', 'date_of_birth', 'date_of_death', 'clan_name', 'village_origin', 'place_of_birth', 'occupation'];
          const rows = data.map((person) =>
            headers
              .map((h) => {
                const value = person[h] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
              })
              .join(',')
          );
          const csv = [headers.join(','), ...rows].join('\n');
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `family_${familyId}_export.csv`;
          link.click();
          URL.revokeObjectURL(url);
        } else if (format === 'pdf-summary') {
          setSnackbar({ open: true, message: 'Generating PDF...', severity: 'info' });
          const treeContainer = treeContainerRef.current || document.querySelector('[data-tree-container]');
          await exportFamilyTreeToPDF(filteredTreeData, familyInfo, 'summary', null, treeContainer);
          setSnackbar({ open: true, message: 'PDF exported successfully!', severity: 'success' });
        } else if (format === 'pdf-book') {
          setSnackbar({ open: true, message: 'Generating PDF with photos... This may take a moment.', severity: 'info' });
          await exportFamilyTreeToPDF(filteredTreeData, familyInfo, 'book');
          setSnackbar({ open: true, message: 'PDF exported successfully!', severity: 'success' });
        } else if (format === 'pdf-tree') {
          setSnackbar({ open: true, message: 'Generating PDF with tree diagram... This may take a moment.', severity: 'info' });
          // Get the tree container element - use the ref or find it in the DOM
          const treeContainer = treeContainerRef.current || document.querySelector('[data-tree-container]');
          await exportFamilyTreeToPDF(filteredTreeData, familyInfo, 'tree', null, treeContainer);
          setSnackbar({ open: true, message: 'PDF exported successfully!', severity: 'success' });
        } else if (format === 'gedcom') {
          exportGEDCOM(filteredTreeData, familyInfo);
        }
        setExportMenuAnchor(null);
      } catch (error) {
        console.error('Failed to export tree:', error);
        setSnackbar({ open: true, message: 'Failed to export family data. Please try again.', severity: 'error' });
      }
    },
    [filteredTreeData, familyId, familyInfo]
  );

  const handleGedcomFileSelect = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseGEDCOM(text);

      // Fetch existing persons for duplicate detection
      const existingRes = await api.get(`/persons/family/${familyId}`);
      const existing = (existingRes.data.persons || []).map((p) => ({
        ...p,
        person_id: p.person_id,
      }));

      setParsedGedcomData(parsed);
      setExistingPersons(existing);
      setGedcomImportOpen(false);
      setGedcomPreviewOpen(true);
    } catch (error) {
      console.error('Failed to parse GEDCOM:', error);
      setSnackbar({ open: true, message: 'Failed to parse GEDCOM file. Please check the file format and try again.', severity: 'error' });
    }
  };

  const handleGedcomImportConfirm = async ({ skipDuplicates, duplicates }) => {
    if (!parsedGedcomData) return;

    setImportingGedcom(true);
    setGedcomPreviewOpen(false);

    try {
      const personIdMap = new Map();
      const duplicateIds = new Set(duplicates.map((d) => d.import.person_id));

      // Filter out duplicates if skipDuplicates is true
      const personsToImport = skipDuplicates
        ? parsedGedcomData.persons.filter((p) => !duplicateIds.has(p.person_id))
        : parsedGedcomData.persons;

      let importedCount = 0;
      let skippedCount = 0;

      // Create persons via API
      for (let i = 0; i < personsToImport.length; i++) {
        const person = personsToImport[i];
        const personData = {
          family_id: parseInt(familyId),
          full_name: person.full_name || 'Unknown',
          gender: person.gender || null,
          date_of_birth: person.date_of_birth || null,
          date_of_death: person.date_of_death || null,
          place_of_birth: person.place_of_birth || null,
          occupation: person.occupation || null,
          biography: person.biography || null,
          clan_name: null,
          village_origin: null,
        };

        const res = await api.post('/persons', personData);
        const newPersonId = res.data.person.person_id;
        personIdMap.set(person.person_id, newPersonId);
        importedCount++;
      }

      skippedCount = skipDuplicates ? duplicates.length : 0;

      // Create relationships via API
      let relationshipCount = 0;
      for (const rel of parsedGedcomData.relationships) {
        const parentId = personIdMap.get(rel.parent_id);
        const childId = personIdMap.get(rel.child_id);
        if (parentId && childId) {
          await api.post('/relationships', {
            person1_id: parentId,
            person2_id: childId,
            relationship_type: 'parent',
          });
          relationshipCount++;
        }
      }

      // Create spouse relationships via API
      let spouseCount = 0;
      for (const spouseRel of parsedGedcomData.spouseRelationships) {
        const spouse1Id = personIdMap.get(spouseRel.spouse1_id);
        const spouse2Id = personIdMap.get(spouseRel.spouse2_id);
        if (spouse1Id && spouse2Id) {
          await api.post('/relationships', {
            person1_id: spouse1Id,
            person2_id: spouse2Id,
            relationship_type: 'spouse',
          });
          spouseCount++;
        }
      }

      // Refresh tree data
      await fetchTreeData();
      setSnackbar({
        open: true,
        message: `Successfully imported ${importedCount} persons${skippedCount > 0 ? ` (${skippedCount} duplicates skipped)` : ''}, ${relationshipCount} relationships, and ${spouseCount} spouse relationships.`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to import GEDCOM:', error);
      setSnackbar({ open: true, message: 'Failed to import GEDCOM file. Please try again.', severity: 'error' });
    } finally {
      setImportingGedcom(false);
      setParsedGedcomData(null);
      setExistingPersons([]);
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar Rail */}
      <Box sx={{
        width: 224, bgcolor: '#FFFFFF', borderRight: '1px solid #E7DCC8',
        p: '20px 14px', flexShrink: 0,
        display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
      }}>
        <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, px: 1, pb: 2, cursor: 'pointer' }}
          onClick={() => navigate('/dashboard')}
        >
          {familyInfo?.family_name || 'Family'}
        </Typography>

        <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8C8171', m: '14px 8px 8px' }}>
          Structure
        </Typography>
        {[
          { label: 'Vertical', value: 'vertical', icon: '↓' },
          { label: 'Horizontal', value: 'horizontal', icon: '→' },
          { label: 'Radial', value: 'radial', icon: '◎' },
          { label: '3D view', value: '3d', icon: '◈' },
        ].map((tab) => (
          <Button key={tab.value} onClick={() => setViewType(tab.value)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: '10px',
              fontSize: '13.5px', fontWeight: 500, textAlign: 'left', width: '100%',
              color: viewType === tab.value ? '#fff' : '#5C5346',
              bgcolor: viewType === tab.value ? '#22345E' : 'transparent',
              boxShadow: viewType === tab.value ? '0 4px 12px rgba(34,52,94,.25)' : 'none',
              '&:hover': { bgcolor: viewType === tab.value ? '#22345E' : '#F3ECE0' },
              textTransform: 'none', minWidth: 0,
            }}
          >
            <Box component="span" sx={{ width: 18, textAlign: 'center', fontSize: 14 }}>{tab.icon}</Box>
            {tab.label}
          </Button>
        ))}

        <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8C8171', m: '14px 8px 8px' }}>
          Chronology
        </Typography>
        {[
          { label: 'Timeline', value: 'timeline', icon: '▤' },
          { label: 'Migration map', value: 'map', icon: '⛝' },
        ].map((tab) => (
          <Button key={tab.value} onClick={() => setViewType(tab.value)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: '10px',
              fontSize: '13.5px', fontWeight: 500, textAlign: 'left', width: '100%',
              color: viewType === tab.value ? '#fff' : '#5C5346',
              bgcolor: viewType === tab.value ? '#22345E' : 'transparent',
              boxShadow: viewType === tab.value ? '0 4px 12px rgba(34,52,94,.25)' : 'none',
              '&:hover': { bgcolor: viewType === tab.value ? '#22345E' : '#F3ECE0' },
              textTransform: 'none', minWidth: 0,
            }}
          >
            <Box component="span" sx={{ width: 18, textAlign: 'center', fontSize: 14 }}>{tab.icon}</Box>
            {tab.label}
          </Button>
        ))}

        <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#8C8171', m: '14px 8px 8px' }}>
          Manage
        </Typography>
        <Button onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: '10px', fontSize: '13.5px', fontWeight: 500, textAlign: 'left', width: '100%', color: '#5C5346', '&:hover': { bgcolor: '#F3ECE0' }, textTransform: 'none', minWidth: 0 }}>
          <Box component="span" sx={{ width: 18, textAlign: 'center', fontSize: 14 }}>⇩</Box>
          Export tree
        </Button>
        <Button onClick={() => setGedcomImportOpen(true)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: '10px', fontSize: '13.5px', fontWeight: 500, textAlign: 'left', width: '100%', color: '#5C5346', '&:hover': { bgcolor: '#F3ECE0' }, textTransform: 'none', minWidth: 0 }}>
          <Box component="span" sx={{ width: 18, textAlign: 'center', fontSize: 14 }}>⇧</Box>
          Import GEDCOM
        </Button>
        <Button onClick={() => navigate(`/family/${familyId}/settings`)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: '10px', fontSize: '13.5px', fontWeight: 500, textAlign: 'left', width: '100%', color: '#5C5346', '&:hover': { bgcolor: '#F3ECE0' }, textTransform: 'none', minWidth: 0 }}>
          <Box component="span" sx={{ width: 18, textAlign: 'center', fontSize: 14 }}>⚙</Box>
          Settings
        </Button>
      </Box>

      {/* Main tree area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tree header */}
        <Box sx={{
          px: 3.5, py: 2, borderBottom: '1px solid #E7DCC8', bgcolor: '#FFFFFF',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2.5, flexWrap: 'wrap',
        }}>
          {/* Mobile back + view tabs */}
          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => navigate('/dashboard')} sx={{ color: '#22345E' }}>
              <ArrowBackIcon />
            </IconButton>
            <Tabs value={viewType} onChange={handleViewChange} variant="scrollable" scrollButtons="auto">
              <Tab label="Vert" value="vertical" sx={{ textTransform: 'none', fontSize: 12 }} />
              <Tab label="Horiz" value="horizontal" sx={{ textTransform: 'none', fontSize: 12 }} />
              <Tab label="Radial" value="radial" sx={{ textTransform: 'none', fontSize: 12 }} />
              <Tab label="3D" value="3d" sx={{ textTransform: 'none', fontSize: 12 }} />
              <Tab label="Time" value="timeline" sx={{ textTransform: 'none', fontSize: 12 }} />
              <Tab label="Map" value="map" sx={{ textTransform: 'none', fontSize: 12 }} />
            </Tabs>
          </Box>

          {/* Search box */}
          <Box onClick={() => setSearchFiltersExpanded(!searchFiltersExpanded)}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#FBF7F0', border: '1px solid #E7DCC8', borderRadius: '10px',
              px: 1.75, py: 1.125, fontSize: '13.5px', color: '#8C8171', minWidth: 220, cursor: 'pointer',
            }}
          >
            <SearchIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: '13.5px', color: '#8C8171', flex: 1 }}>
              {searchQuery || clanFilter || villageFilter
                ? `${searchQuery || ''} ${clanFilter ? `| Clan: ${clanFilter}` : ''} ${villageFilter ? `| Village: ${villageFilter}` : ''}`
                : 'Search people…'}
            </Typography>
            {searchFiltersExpanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </Box>

          {/* Filter chips */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Box onClick={() => setSearchFiltersExpanded(true)} sx={{
              fontSize: '12.5px', fontFamily: "'IBM Plex Mono', monospace", px: 1.625, py: 0.75, borderRadius: '20px',
              bgcolor: '#fff', border: '1px solid #E7DCC8', color: '#5C5346', cursor: 'pointer',
            }}>
              Clan: {clanFilter || 'any'} ▾
            </Box>
            <Box onClick={() => setSearchFiltersExpanded(true)} sx={{
              fontSize: '12.5px', fontFamily: "'IBM Plex Mono', monospace", px: 1.625, py: 0.75, borderRadius: '20px',
              bgcolor: '#fff', border: '1px solid #E7DCC8', color: '#5C5346', cursor: 'pointer',
            }}>
              Village: {villageFilter || 'any'} ▾
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <IconButton onClick={(e) => setRelationshipAnchor(e.currentTarget)} sx={{
              width: 36, height: 36, borderRadius: '10px', border: '1px solid #E7DCC8',
              bgcolor: '#fff', color: '#5C5346', '&:hover': { borderColor: '#3A4F82', color: '#22345E' },
            }}>
              <SearchIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton onClick={(e) => setExportMenuAnchor(e.currentTarget)} sx={{
              width: 36, height: 36, borderRadius: '10px', border: '1px solid #E7DCC8',
              bgcolor: '#fff', color: '#5C5346', '&:hover': { borderColor: '#3A4F82', color: '#22345E' },
            }}>
              <FileDownloadIcon sx={{ fontSize: 16 }} />
            </IconButton>
            <IconButton onClick={() => navigate(`/family/${familyId}/settings`)} sx={{
              width: 36, height: 36, borderRadius: '10px', border: '1px solid #E7DCC8',
              bgcolor: '#fff', color: '#5C5346', '&:hover': { borderColor: '#3A4F82', color: '#22345E' },
            }}>
              <SettingsIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Collapsible search filters */}
        <Collapse in={searchFiltersExpanded}>
          <Box sx={{ p: 2, bgcolor: '#FFFFFF', borderBottom: '1px solid #E7DCC8' }}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by name, clan, village, occupation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')} edge="end">
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <Autocomplete
                options={clanOptions}
                value={clanFilter || null}
                onChange={(e, value) => setClanFilter(value || '')}
                renderInput={(params) => <TextField {...params} label="Filter by Clan" variant="outlined" placeholder="Select clan" size="small" />}
                sx={{ minWidth: 200, flex: '1 1 200px' }}
                clearOnEscape
                freeSolo={false}
              />
              <Autocomplete
                options={villageOptions}
                value={villageFilter || null}
                onChange={(e, value) => setVillageFilter(value || '')}
                renderInput={(params) => <TextField {...params} label="Filter by Village/Town" variant="outlined" placeholder="Select village" size="small" />}
                sx={{ minWidth: 200, flex: '1 1 200px' }}
                clearOnEscape
                freeSolo={false}
              />
              {(clanFilter || villageFilter || searchQuery) && (
                <Button startIcon={<ClearIcon />} onClick={() => { setSearchQuery(''); setClanFilter(''); setVillageFilter(''); }} size="small" variant="outlined" sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }}>
                  Clear Filters
                </Button>
              )}
            </Box>
          </Box>
        </Collapse>

        {/* Tree canvas */}
        <Box ref={treeContainerRef} className="tree-canvas-bg" sx={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: 'radial-gradient(circle at 1px 1px, #E7DCC8 1px, transparent 0) 0 0/24px 24px, #FBF7F0',
        }} data-tree-container>
          {renderTreeView}

          {/* Heritage Panel - Bottom Right */}
          {selectedPersonForStory && (
            <Paper
              elevation={8}
              sx={{
                position: 'absolute', bottom: 20, right: 20, width: 300,
                maxHeight: '40vh', overflowY: 'auto', borderRadius: '16px',
                p: 2.5, border: '1px solid #E7DCC8', bgcolor: '#FFFFFF',
                boxShadow: '0 12px 32px rgba(34,52,94,.15)', zIndex: 100,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box>
                  {selectedPersonForStory.traditional_title && (
                    <Typography sx={{ 
                      fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, 
                      fontWeight: 700, color: '#D79A1E', mb: 0.5 
                    }}>
                      {selectedPersonForStory.traditional_title.toUpperCase()}
                    </Typography>
                  )}
                  <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, color: '#22345E' }}>
                    {selectedPersonForStory.full_name}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => setSelectedPersonForStory(null)}>
                  <ClearIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>

              <Typography variant="body2" sx={{ color: '#5C5346', mb: 2, fontSize: '13px', lineHeight: 1.6 }}>
                {selectedPersonForStory.biography || selectedPersonForStory.legacy_story || "This ancestor's story is yet to be fully told. Preserving our heritage, one generation at a time."}
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button 
                  size="small" variant="contained" 
                  onClick={() => navigate(`/person/${selectedPersonForStory.person_id}`)}
                  sx={{ bgcolor: '#22345E', textTransform: 'none', borderRadius: '8px', fontSize: '12px' }}
                >
                  Full Profile
                </Button>
                <Button 
                  size="small" variant="outlined" 
                  onClick={() => setFocalPersonId(String(selectedPersonForStory.person_id))}
                  sx={{ borderColor: '#22345E', color: '#22345E', textTransform: 'none', borderRadius: '8px', fontSize: '12px' }}
                >
                  Set as Focus
                </Button>
              </Box>
            </Paper>
          )}

          {/* Insights panel */}
          {stats && (
            <Box sx={{
              position: 'absolute', top: 20, right: 20, bgcolor: '#FFFFFF', borderRadius: '14px',
              p: '16px 18px', border: '1px solid #E7DCC8', fontSize: '12.5px', width: 180,
              boxShadow: '0 10px 24px rgba(28,20,16,.08)', zIndex: 10,
            }}>
              <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#8C8171', mb: 1.25 }}>
                Tree insights
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.625, borderBottom: '1px dashed #E7DCC8', '&:last-child': { borderBottom: 'none' } }}>
                <Typography sx={{ fontSize: '12.5px', color: '#5C5346' }}>Total people</Typography>
                <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: '12.5px' }}>{stats.total}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.625, borderBottom: '1px dashed #E7DCC8' }}>
                <Typography sx={{ fontSize: '12.5px', color: '#5C5346' }}>Male</Typography>
                <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: '12.5px' }}>{stats.maleCount}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.625, borderBottom: '1px dashed #E7DCC8' }}>
                <Typography sx={{ fontSize: '12.5px', color: '#5C5346' }}>Female</Typography>
                <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: '12.5px' }}>{stats.femaleCount}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.625 }}>
                <Typography sx={{ fontSize: '12.5px', color: '#5C5346' }}>Clans</Typography>
                <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: '12.5px' }}>{Object.keys(stats.clanCounts).length}</Typography>
              </Box>
              <Box sx={{ mt: 1.25, pt: 1.25, borderTop: '1px dashed #E7DCC8' }}>
                <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, textTransform: 'uppercase', color: '#8C8171', mb: 0.5 }}>Top clans</Typography>
                {Object.entries(stats.clanCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([clan, count]) => (
                  <Typography key={clan} sx={{ fontSize: '11.5px', color: '#5C5346' }}>{clan} ({count})</Typography>
                ))}
                {Object.keys(stats.clanCounts).length === 0 && (
                  <Typography sx={{ fontSize: '11.5px', color: '#8C8171' }}>No clan data</Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Add person FAB */}
          <Button
            onClick={handleAddPersonClick}
            sx={{
              position: 'absolute', bottom: 24, right: 24, bgcolor: '#22345E', color: '#fff',
              px: 2.75, py: 1.625, borderRadius: '30px', fontSize: 14, fontWeight: 600,
              textTransform: 'none', boxShadow: '0 8px 22px rgba(34,52,94,.32)',
              display: 'flex', alignItems: 'center', gap: 1, zIndex: 10,
              '&:hover': { bgcolor: '#22345E', transform: 'translateY(-2px)' },
            }}
          >
            <AddIcon sx={{ fontSize: 18 }} /> Add person
          </Button>
        </Box>
      </Box>

      {/* Export Menu */}
      <Menu anchorEl={exportMenuAnchor} open={Boolean(exportMenuAnchor)} onClose={() => setExportMenuAnchor(null)}>
        <MenuItem onClick={() => handleExport('json')}><FileDownloadIcon sx={{ mr: 1 }} /> Export JSON</MenuItem>
        <MenuItem onClick={() => handleExport('csv')}><FileDownloadIcon sx={{ mr: 1 }} /> Export CSV</MenuItem>
        <MenuItem onClick={() => handleExport('gedcom')}><FileDownloadIcon sx={{ mr: 1 }} /> Export GEDCOM</MenuItem>
        <MenuItem onClick={() => handleExport('pdf-summary')}><PdfIcon sx={{ mr: 1 }} /> Export PDF (Summary)</MenuItem>
        <MenuItem onClick={() => handleExport('pdf-book')}><PdfIcon sx={{ mr: 1 }} /> Export PDF (Book)</MenuItem>
        <MenuItem onClick={() => handleExport('pdf-tree')}><PdfIcon sx={{ mr: 1 }} /> Export PDF (Tree)</MenuItem>
      </Menu>

        {/* Relationship Calculator Dialog */}
        <Dialog open={Boolean(relationshipAnchor)} onClose={() => setRelationshipAnchor(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontFamily: "'Fraunces', serif" }}>Relationship Finder</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Autocomplete
                options={treeData?.nodes || []}
                getOptionLabel={(option) => option.data.full_name}
                value={relationshipPerson1}
                onChange={(e, val) => setRelationshipPerson1(val)}
                renderInput={(params) => <TextField {...params} label="First Person" size="small" />}
              />
              <Autocomplete
                options={treeData?.nodes || []}
                getOptionLabel={(option) => option.data.full_name}
                value={relationshipPerson2}
                onChange={(e, val) => setRelationshipPerson2(val)}
                renderInput={(params) => <TextField {...params} label="Second Person" size="small" />}
              />
              {calculatedRelationship && (
                <Paper sx={{ p: 2, bgcolor: '#FBF7F0', border: '1px solid #E7DCC8', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ color: '#8C8171', mb: 0.5 }}>Relationship:</Typography>
                  <Typography variant="h6" sx={{ color: '#22345E', fontWeight: 600 }}>{calculatedRelationship}</Typography>
                </Paper>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setRelationshipPerson1(null); setRelationshipPerson2(null); setRelationship(null); }} size="small">Clear</Button>
            <Button onClick={() => setRelationshipAnchor(null)} variant="contained" sx={{ bgcolor: '#22345E' }}>Close</Button>
          </DialogActions>
        </Dialog>
      <Dialog open={gedcomImportOpen} onClose={() => setGedcomImportOpen(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Import GEDCOM File</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select a GEDCOM file (.ged) to import family tree data. You'll be able to preview and review the data before importing.
          </DialogContentText>
          <input accept=".ged" style={{ display: 'none' }} id="gedcom-upload" type="file"
            onChange={(e) => { const file = e.target.files[0]; if (file) handleGedcomFileSelect(file); }}
            disabled={importingGedcom}
          />
          <label htmlFor="gedcom-upload">
            <Button variant="outlined" component="span" fullWidth startIcon={<UploadIcon />} disabled={importingGedcom} sx={{ py: 2, borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }}>
              Choose GEDCOM File
            </Button>
          </label>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setGedcomImportOpen(false)} disabled={importingGedcom} variant="outlined" sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* GEDCOM Import Preview Dialog */}
      <GedcomImportPreview
        open={gedcomPreviewOpen}
        onClose={() => { setGedcomPreviewOpen(false); setParsedGedcomData(null); setExistingPersons([]); }}
        onConfirm={handleGedcomImportConfirm}
        parsedData={parsedGedcomData}
        existingPersons={existingPersons}
        importing={importingGedcom}
      />

      {/* Profile Completion Dialog */}
      <Dialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)} PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600 }}>Complete Your Profile First</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Before you can add family members to your tree, please complete your profile information.
            This helps us create a more accurate family tree and ensures you're properly represented in your family history.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setProfileDialogOpen(false)} variant="outlined" sx={{ borderColor: '#EAEEF6', color: '#22345E', textTransform: 'none' }}>Cancel</Button>
          <Button onClick={() => { sessionStorage.setItem('returnAfterProfileCompletion', `/family/${familyId}/tree`); navigate('/profile-completion'); }} variant="contained">
            Complete Profile
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default FamilyTree;

