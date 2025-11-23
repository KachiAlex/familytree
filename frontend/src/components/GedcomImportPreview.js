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
  LinearProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  PersonAdd as PersonAddIcon,
  Link as LinkIcon,
} from '@mui/icons-material';

const GedcomImportPreview = ({ open, onClose, onConfirm, parsedData, existingPersons, importing }) => {
  const [duplicates, setDuplicates] = useState([]);
  const [newPersons, setNewPersons] = useState([]);
  const [selectedTab, setSelectedTab] = useState(0);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [importStats, setImportStats] = useState({
    total: 0,
    new: 0,
    duplicates: 0,
    relationships: 0,
    spouseRelationships: 0,
  });

  useEffect(() => {
    if (parsedData && existingPersons) {
      detectDuplicates();
    }
  }, [parsedData, existingPersons]);

  const detectDuplicates = () => {
    if (!parsedData || !existingPersons) return;

    const duplicateList = [];
    const newList = [];

    parsedData.persons.forEach((importPerson) => {
      const match = existingPersons.find((existing) => {
        // Match by name (case-insensitive, partial match)
        const nameMatch =
          existing.full_name &&
          importPerson.full_name &&
          existing.full_name.toLowerCase().trim() === importPerson.full_name.toLowerCase().trim();

        // Match by birth date if available
        let dateMatch = false;
        if (existing.date_of_birth && importPerson.date_of_birth) {
          const existingDate = new Date(existing.date_of_birth).toISOString().split('T')[0];
          const importDate = new Date(importPerson.date_of_birth).toISOString().split('T')[0];
          dateMatch = existingDate === importDate;
        }

        return nameMatch || (nameMatch && dateMatch);
      });

      if (match) {
        duplicateList.push({
          import: importPerson,
          existing: match,
          confidence: match.date_of_birth && importPerson.date_of_birth ? 'high' : 'medium',
        });
      } else {
        newList.push(importPerson);
      }
    });

    setDuplicates(duplicateList);
    setNewPersons(newList);
    setImportStats({
      total: parsedData.persons.length,
      new: newList.length,
      duplicates: duplicateList.length,
      relationships: parsedData.relationships?.length || 0,
      spouseRelationships: parsedData.spouseRelationships?.length || 0,
    });
  };

  const handleConfirm = () => {
    onConfirm({
      skipDuplicates,
      duplicates: skipDuplicates ? duplicates : [],
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { maxHeight: '90vh' } }}>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonAddIcon />
          <Typography variant="h6">GEDCOM Import Preview</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {importing ? (
          <Box>
            <LinearProgress sx={{ mb: 2 }} />
            <Typography variant="body1" align="center">
              Importing data... Please wait.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Import Statistics */}
            <Box sx={{ mb: 3 }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Import Summary
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                  <Chip label={`Total: ${importStats.total} persons`} color="primary" />
                  <Chip label={`New: ${importStats.new}`} color="success" icon={<CheckCircleIcon />} />
                  <Chip
                    label={`Duplicates: ${importStats.duplicates}`}
                    color={importStats.duplicates > 0 ? 'warning' : 'default'}
                    icon={importStats.duplicates > 0 ? <WarningIcon /> : null}
                  />
                  <Chip label={`Relationships: ${importStats.relationships}`} />
                  <Chip label={`Spouse Relationships: ${importStats.spouseRelationships}`} />
                </Box>
              </Alert>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={skipDuplicates}
                    onChange={(e) => setSkipDuplicates(e.target.checked)}
                  />
                }
                label="Skip duplicate persons (recommended)"
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Tabs for New vs Duplicates */}
            <Tabs value={selectedTab} onChange={(e, v) => setSelectedTab(v)} sx={{ mb: 2 }}>
              <Tab label={`New Persons (${newPersons.length})`} />
              <Tab label={`Potential Duplicates (${duplicates.length})`} />
            </Tabs>

            {/* New Persons Tab */}
            {selectedTab === 0 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Gender</TableCell>
                      <TableCell>Birth Date</TableCell>
                      <TableCell>Birth Place</TableCell>
                      <TableCell>Death Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {newPersons.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No new persons to import
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      newPersons.slice(0, 50).map((person, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {person.full_name || 'Unknown'}
                            </Typography>
                          </TableCell>
                          <TableCell>{person.gender || '-'}</TableCell>
                          <TableCell>
                            {person.date_of_birth
                              ? new Date(person.date_of_birth).toLocaleDateString()
                              : '-'}
                          </TableCell>
                          <TableCell>{person.place_of_birth || '-'}</TableCell>
                          <TableCell>
                            {person.date_of_death
                              ? new Date(person.date_of_death).toLocaleDateString()
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {newPersons.length > 50 && (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary">
                            ... and {newPersons.length - 50} more persons
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Duplicates Tab */}
            {selectedTab === 1 && (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Import Person</TableCell>
                      <TableCell>Existing Person</TableCell>
                      <TableCell>Match Confidence</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {duplicates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body2" color="text.secondary">
                            No duplicates found
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      duplicates.map((dup, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {dup.import.full_name || 'Unknown'}
                            </Typography>
                            {dup.import.date_of_birth && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                Born: {new Date(dup.import.date_of_birth).toLocaleDateString()}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinkIcon fontSize="small" color="action" />
                              <Box>
                                <Typography variant="body2" fontWeight="medium">
                                  {dup.existing.full_name || 'Unknown'}
                                </Typography>
                                {dup.existing.date_of_birth && (
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    Born: {new Date(dup.existing.date_of_birth).toLocaleDateString()}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={dup.confidence === 'high' ? 'High' : 'Medium'}
                              color={dup.confidence === 'high' ? 'success' : 'warning'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {skipDuplicates ? (
                              <Chip label="Will Skip" color="default" size="small" />
                            ) : (
                              <Chip label="Will Import" color="warning" size="small" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={importing}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained" disabled={importing || importStats.new === 0}>
          {skipDuplicates
            ? `Import ${importStats.new} New Persons`
            : `Import All ${importStats.total} Persons`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GedcomImportPreview;

