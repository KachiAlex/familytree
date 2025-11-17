import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  TextField,
  InputAdornment,
  Autocomplete,
  Chip,
  Menu,
  MenuItem,
  LinearProgress,
  Snackbar,
  Alert,
  Skeleton,
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
} from '@mui/icons-material';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
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
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [gedcomImportOpen, setGedcomImportOpen] = useState(false);
  const [importingGedcom, setImportingGedcom] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Only fetch when familyId changes, not when viewType changes
  useEffect(() => {
    fetchTreeData();
    fetchFamilyInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const fetchFamilyInfo = async () => {
    try {
      const familyRef = doc(db, 'families', familyId);
      const familySnap = await getDoc(familyRef);
      if (familySnap.exists()) {
        setFamilyInfo({ family_id: familySnap.id, ...familySnap.data() });
      }
    } catch (error) {
      console.error('Failed to fetch family info:', error);
    }
  };

  const fetchTreeData = async () => {
    try {
      setLoading(true);

      // Fetch persons, relationships, and spouse relationships in parallel
      const [personsSnap, relSnap, spouseSnap] = await Promise.all([
        getDocs(query(collection(db, 'persons'), where('family_id', '==', familyId))),
        getDocs(query(collection(db, 'relationships'), where('family_id', '==', familyId))),
        getDocs(query(collection(db, 'spouseRelationships'), where('family_id', '==', familyId))),
      ]);

      const persons = personsSnap.docs.map((docSnap) => ({
        person_id: docSnap.id,
        ...docSnap.data(),
      }));

      const nodes = persons.map((p) => ({
        id: p.person_id,
        data: {
          ...p,
          label: p.full_name,
        },
      }));

      const edges = relSnap.docs.map((relDoc) => {
        const rel = relDoc.data();
        return {
          id: relDoc.id,
          source: rel.parent_id,
          target: rel.child_id,
          type: 'parent',
          verified: false,
          label: 'parent',
        };
      });

      // Add spouse relationships as edges
      const spouseEdges = spouseSnap.docs.map((spouseDoc) => {
        const spouse = spouseDoc.data();
        return {
          id: spouseDoc.id,
          source: spouse.spouse1_id,
          target: spouse.spouse2_id,
          type: 'spouse',
          verified: false,
          label: 'spouse',
        };
      });

      // Combine all edges
      const allEdges = [...edges, ...spouseEdges];

      // Find root nodes (nodes with no parents) - optimized
      const hasParent = new Set(edges.map((e) => e.target));
      const rootNodes = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);

      const data = {
        nodes,
        edges: allEdges,
        rootNodes,
      };
      setTreeData(data);
      setFilteredTreeData(data);

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

    const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));

    // Include edges that connect filtered nodes
    const filteredEdges = treeData.edges.filter(
      (edge) => filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
    );

    // Find root nodes from filtered nodes
    const hasParent = new Set(
      filteredEdges.filter((e) => e.type === 'parent').map((e) => e.target)
    );
    const filteredRootNodes = filteredNodes
      .filter((n) => !hasParent.has(n.id))
      .map((n) => n.id);

    setFilteredTreeData({
      nodes: filteredNodes,
      edges: filteredEdges,
      rootNodes: filteredRootNodes,
    });
  }, [searchQuery, clanFilter, villageFilter, treeData]);

  // Memoize the tree data with current viewType
  const treeDataWithView = useMemo(() => {
    if (!filteredTreeData) return null;
    return { ...filteredTreeData, viewType };
  }, [filteredTreeData, viewType]);

  const handleViewChange = useCallback((event, newValue) => {
    setViewType(newValue);
  }, []);

  const handlePersonClick = useCallback((personId) => {
    if (!personId) return;
    navigate(`/person/${personId}`);
  }, [navigate]);

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
        return <VerticalTreeView data={treeDataWithView} onPersonClick={handlePersonClick} />;
      case 'horizontal':
        return <HorizontalTreeView data={treeDataWithView} onPersonClick={handlePersonClick} />;
      case 'radial':
        return <RadialTreeView data={treeDataWithView} onPersonClick={handlePersonClick} />;
      case '3d':
        return <ThreeDTreeView data={treeDataWithView} onPersonClick={handlePersonClick} />;
      case 'timeline':
        return <TimelineView familyId={familyId} />;
      case 'map':
        return <MigrationMapView familyId={familyId} />;
      default:
        return <VerticalTreeView data={treeDataWithView} onPersonClick={handlePersonClick} />;
    }
  }, [loading, treeDataWithView, viewType, handlePersonClick, familyId, filteredTreeData, searchQuery]);

  const handleExport = useCallback(
    (format) => {
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
          exportFamilyTreeToPDF(filteredTreeData, familyInfo, 'summary');
        } else if (format === 'pdf-book') {
          exportFamilyTreeToPDF(filteredTreeData, familyInfo, 'book');
        } else if (format === 'pdf-tree') {
          exportFamilyTreeToPDF(filteredTreeData, familyInfo, 'tree');
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

  const handleGedcomImport = async (file) => {
    if (!file) return;

    setImportingGedcom(true);
    try {
      const text = await file.text();
      const parsed = parseGEDCOM(text);

      // Create persons in Firestore
      const personsRef = collection(db, 'persons');
      const personIdMap = new Map();

      for (const person of parsed.persons) {
        const personData = {
          family_id: familyId,
          full_name: person.full_name || 'Unknown',
          gender: person.gender || null,
          date_of_birth: person.date_of_birth || null,
          date_of_death: person.date_of_death || null,
          place_of_birth: person.place_of_birth || null,
          place_of_death: person.place_of_death || null,
          occupation: person.occupation || null,
          biography: person.biography || null,
          clan_name: null,
          village_origin: null,
          created_at: serverTimestamp(),
        };

        const docRef = await addDoc(personsRef, personData);
        personIdMap.set(person.person_id, docRef.id);
      }

      // Create relationships
      const relationshipsRef = collection(db, 'relationships');
      for (const rel of parsed.relationships) {
        const parentId = personIdMap.get(rel.parent_id);
        const childId = personIdMap.get(rel.child_id);
        if (parentId && childId) {
          await addDoc(relationshipsRef, {
            family_id: familyId,
            parent_id: parentId,
            child_id: childId,
            created_at: serverTimestamp(),
          });
        }
      }

      // Create spouse relationships
      const spouseRelationshipsRef = collection(db, 'spouseRelationships');
      for (const spouseRel of parsed.spouseRelationships) {
        const spouse1Id = personIdMap.get(spouseRel.spouse1_id);
        const spouse2Id = personIdMap.get(spouseRel.spouse2_id);
        if (spouse1Id && spouse2Id) {
          await addDoc(spouseRelationshipsRef, {
            family_id: familyId,
            spouse1_id: spouse1Id,
            spouse2_id: spouse2Id,
            created_at: serverTimestamp(),
          });
        }
      }

      // Refresh tree data
      await fetchTreeData();
      setGedcomImportOpen(false);
      setSnackbar({ open: true, message: `Successfully imported ${parsed.persons.length} persons from GEDCOM file.`, severity: 'success' });
    } catch (error) {
      console.error('Failed to import GEDCOM:', error);
      setSnackbar({ open: true, message: 'Failed to import GEDCOM file. Please check the file format and try again.', severity: 'error' });
    } finally {
      setImportingGedcom(false);
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Family Tree
          </Typography>
          <Button
            color="inherit"
            startIcon={<AddIcon />}
            onClick={handleAddPersonClick}
          >
            Add Person
          </Button>
          <IconButton
            color="inherit"
            onClick={() => navigate(`/family/${familyId}/settings`)}
          >
            <SettingsIcon />
          </IconButton>
          <Box sx={{ display: 'flex', gap: 1, ml: 2 }}>
            <Button
              color="inherit"
              startIcon={<FileDownloadIcon />}
              onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            >
              Export
            </Button>
            <Button
              color="inherit"
              startIcon={<UploadIcon />}
              onClick={() => setGedcomImportOpen(true)}
            >
              Import GEDCOM
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Search Bar */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by name, clan, village, occupation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setSearchQuery('')}
                  edge="end"
                >
                  <ClearIcon />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        {searchQuery && filteredTreeData && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Found {filteredTreeData.nodes.length} person{filteredTreeData.nodes.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </Typography>
        )}
        <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Autocomplete
            options={clanOptions}
            value={clanFilter || null}
            onChange={(e, value) => setClanFilter(value || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter by Clan"
                variant="outlined"
                placeholder="Select clan"
              />
            )}
            sx={{ minWidth: 250 }}
            clearOnEscape
            freeSolo={false}
          />
          <Autocomplete
            options={villageOptions}
            value={villageFilter || null}
            onChange={(e, value) => setVillageFilter(value || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Filter by Village/Town"
                variant="outlined"
                placeholder="Select village"
              />
            )}
            sx={{ minWidth: 250 }}
            clearOnEscape
            freeSolo={false}
          />
          {(clanFilter || villageFilter || searchQuery) && (
            <Button
              startIcon={<ClearIcon />}
              onClick={() => {
                setSearchQuery('');
                setClanFilter('');
                setVillageFilter('');
              }}
            >
              Clear Filters
            </Button>
          )}
        </Box>
      </Box>

      {/* Statistics Panel */}
      {stats && (
        <Box sx={{ p: 2, bgcolor: '#f9fafb', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
            Family Insights
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Paper sx={{ p: 2, flex: '1 1 200px' }}>
              <Typography variant="body2" color="text.secondary">
                Total Persons
              </Typography>
              <Typography variant="h5">{stats.total}</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: '1 1 200px' }}>
              <Typography variant="body2" color="text.secondary">
                Gender Distribution
              </Typography>
              <Typography variant="body1">
                Male: {stats.maleCount} • Female: {stats.femaleCount} • Other: {stats.otherCount}
              </Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: '1 1 300px' }}>
              <Typography variant="body2" color="text.secondary">
                Top Clans
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {Object.entries(stats.clanCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([clan, count]) => (
                    <Chip key={clan} label={`${clan} (${count})`} size="small" />
                  ))}
                {Object.keys(stats.clanCounts).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No clan data yet
                  </Typography>
                )}
              </Box>
            </Paper>
            <Paper sx={{ p: 2, flex: '1 1 300px' }}>
              <Typography variant="body2" color="text.secondary">
                Top Villages/Towns
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {Object.entries(stats.villageCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([village, count]) => (
                    <Chip key={village} label={`${village} (${count})`} size="small" />
                  ))}
                {Object.keys(stats.villageCounts).length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    No village data yet
                  </Typography>
                )}
              </Box>
            </Paper>
          </Box>
        </Box>
      )}

      <Paper sx={{ borderRadius: 0 }}>
        <Tabs
          value={viewType}
          onChange={handleViewChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Vertical" value="vertical" />
          <Tab label="Horizontal" value="horizontal" />
          <Tab label="Radial" value="radial" />
          <Tab label="3D" value="3d" />
          <Tab label="Timeline" value="timeline" />
          <Tab label="Migration Map" value="map" />
        </Tabs>
      </Paper>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {renderTreeView}
      </Box>

      {/* Export Menu */}
      <Menu
        anchorEl={exportMenuAnchor}
        open={Boolean(exportMenuAnchor)}
        onClose={() => setExportMenuAnchor(null)}
      >
        <MenuItem onClick={() => handleExport('json')}>
          <FileDownloadIcon sx={{ mr: 1 }} /> Export JSON
        </MenuItem>
        <MenuItem onClick={() => handleExport('csv')}>
          <FileDownloadIcon sx={{ mr: 1 }} /> Export CSV
        </MenuItem>
        <MenuItem onClick={() => handleExport('gedcom')}>
          <FileDownloadIcon sx={{ mr: 1 }} /> Export GEDCOM
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf-summary')}>
          <PdfIcon sx={{ mr: 1 }} /> Export PDF (Summary)
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf-book')}>
          <PdfIcon sx={{ mr: 1 }} /> Export PDF (Book)
        </MenuItem>
        <MenuItem onClick={() => handleExport('pdf-tree')}>
          <PdfIcon sx={{ mr: 1 }} /> Export PDF (Tree)
        </MenuItem>
      </Menu>

      {/* GEDCOM Import Dialog */}
      <Dialog open={gedcomImportOpen} onClose={() => setGedcomImportOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Import GEDCOM File</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Select a GEDCOM file (.ged) to import family tree data. This will add all persons and relationships from the file to your family tree.
          </DialogContentText>
          {importingGedcom && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="body2" sx={{ mt: 1 }}>
                Importing GEDCOM file...
              </Typography>
            </Box>
          )}
          <input
            accept=".ged"
            style={{ display: 'none' }}
            id="gedcom-upload"
            type="file"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handleGedcomImport(file);
              }
            }}
            disabled={importingGedcom}
          />
          <label htmlFor="gedcom-upload">
            <Button
              variant="outlined"
              component="span"
              fullWidth
              startIcon={<UploadIcon />}
              disabled={importingGedcom}
              sx={{ py: 2 }}
            >
              Choose GEDCOM File
            </Button>
          </label>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGedcomImportOpen(false)} disabled={importingGedcom}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Profile Completion Dialog */}
      <Dialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)}>
        <DialogTitle>Complete Your Profile First</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Before you can add family members to your tree, please complete your profile information.
            This helps us create a more accurate family tree and ensures you're properly represented
            in your family history.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProfileDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              sessionStorage.setItem('returnAfterProfileCompletion', `/family/${familyId}/tree`);
              navigate('/profile-completion');
            }}
            variant="contained"
          >
            Complete Profile
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
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

export default FamilyTree;

