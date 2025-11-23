import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Box, Typography, Paper, Slider, Chip, IconButton, Tooltip } from '@mui/material';
import { PlayArrow, Pause, SkipNext, SkipPrevious } from '@mui/icons-material';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MigrationMapView = ({ familyId }) => {
  const [persons, setPersons] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearRange, setYearRange] = useState([1800, new Date().getFullYear()]);
  const [selectedYear, setSelectedYear] = useState(null); // For timeline slider
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1000); // ms per year

  useEffect(() => {
    fetchPersons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const fetchPersons = async () => {
    try {
      setLoading(true);
      const [personsSnap, relSnap] = await Promise.all([
        getDocs(query(collection(db, 'persons'), where('family_id', '==', familyId))),
        getDocs(query(collection(db, 'relationships'), where('family_id', '==', familyId))),
      ]);

      const personsList = personsSnap.docs.map((docSnap) => ({
        person_id: docSnap.id,
        ...docSnap.data(),
      }));

      const relationshipsList = relSnap.docs.map((docSnap) => ({
        relationship_id: docSnap.id,
        ...docSnap.data(),
      }));

      setPersons(personsList);
      setRelationships(relationshipsList);

      // Calculate year range from data
      const years = [];
      personsList.forEach((person) => {
        if (person.date_of_birth) {
          const year = new Date(person.date_of_birth).getFullYear();
          if (!isNaN(year)) years.push(year);
        }
        if (person.date_of_death) {
          const year = new Date(person.date_of_death).getFullYear();
          if (!isNaN(year)) years.push(year);
        }
      });

      if (years.length > 0) {
        const minYear = Math.min(...years);
        const maxYear = Math.max(...years);
        const range = [Math.max(1800, minYear - 10), Math.min(new Date().getFullYear(), maxYear + 10)];
        setYearRange(range);
        setSelectedYear(range[0]); // Initialize timeline to start year
      }
    } catch (error) {
      console.error('Failed to fetch persons:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate generation for each person
  const personGenerations = useMemo(() => {
    const generations = new Map();
    const childrenMap = new Map();
    
    // Build children map
    relationships.forEach((rel) => {
      if (!childrenMap.has(rel.parent_id)) {
        childrenMap.set(rel.parent_id, []);
      }
      childrenMap.get(rel.parent_id).push(rel.child_id);
    });

    // Find root nodes (persons with no parents)
    const hasParent = new Set(relationships.map((r) => r.child_id));
    const rootNodes = persons.filter((p) => !hasParent.has(p.person_id)).map((p) => p.person_id);

    // Assign generation 0 to root nodes
    rootNodes.forEach((rootId) => {
      generations.set(rootId, 0);
    });

    // Recursively assign generations
    const assignGeneration = (personId, gen) => {
      if (generations.has(personId)) return generations.get(personId);
      
      const children = childrenMap.get(personId) || [];
      if (children.length > 0) {
        generations.set(personId, gen);
        children.forEach((childId) => {
          assignGeneration(childId, gen + 1);
        });
      } else {
        generations.set(personId, gen);
      }
      return gen;
    };

    rootNodes.forEach((rootId) => {
      assignGeneration(rootId, 0);
    });

    // Handle persons not connected to root (assign max generation + 1)
    persons.forEach((person) => {
      if (!generations.has(person.person_id)) {
        generations.set(person.person_id, 10); // Default to high generation
      }
    });

    return generations;
  }, [persons, relationships]);

  // Get color for generation
  const getGenerationColor = (generation) => {
    const colors = [
      '#FF6B6B', // Red - oldest generation
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#96CEB4', // Green
      '#FFEAA7', // Yellow
      '#DDA15E', // Orange
      '#A8DADC', // Light Blue
      '#F1C0E8', // Pink
      '#CFBAF0', // Purple
      '#90E0EF', // Cyan
    ];
    return colors[generation % colors.length] || '#95A5A6';
  };

  // Get coordinates for a place (simplified - in production, use geocoding API)
  const getCoordinates = (placeName) => {
    if (!placeName) return null;
    
    // Simple mapping for common African cities (in production, use a geocoding service)
    const placeMap = {
      'lagos': [6.5244, 3.3792],
      'abuja': [9.0765, 7.3986],
      'accra': [5.6037, -0.1870],
      'nairobi': [-1.2921, 36.8219],
      'cairo': [30.0444, 31.2357],
      'kinshasa': [-4.3276, 15.3136],
      'johannesburg': [-26.2041, 28.0473],
      'cape town': [-33.9249, 18.4241],
      'dakar': [14.7167, -17.4677],
      'addis ababa': [9.1450, 38.7667],
    };

    const normalized = placeName.toLowerCase().trim();
    for (const [key, coords] of Object.entries(placeMap)) {
      if (normalized.includes(key)) {
        return coords;
      }
    }

    // Default: return null (would need geocoding API in production)
    return null;
  };

  // Filter persons by selected year (for timeline) or year range
  const filteredPersons = useMemo(() => {
    if (selectedYear !== null) {
      // Timeline mode: show persons active in selected year
      return persons.filter((person) => {
        const birthYear = person.date_of_birth ? new Date(person.date_of_birth).getFullYear() : null;
        const deathYear = person.date_of_death ? new Date(person.date_of_death).getFullYear() : null;
        
        if (birthYear && !isNaN(birthYear) && deathYear && !isNaN(deathYear)) {
          return selectedYear >= birthYear && selectedYear <= deathYear;
        }
        if (birthYear && !isNaN(birthYear)) {
          return selectedYear >= birthYear;
        }
        if (deathYear && !isNaN(deathYear)) {
          return selectedYear <= deathYear;
        }
        return false;
      });
    } else {
      // Range mode: show persons in year range
      return persons.filter((person) => {
        const birthYear = person.date_of_birth ? new Date(person.date_of_birth).getFullYear() : null;
        const deathYear = person.date_of_death ? new Date(person.date_of_death).getFullYear() : null;
        
        if (birthYear && !isNaN(birthYear)) {
          return birthYear >= yearRange[0] && birthYear <= yearRange[1];
        }
        if (deathYear && !isNaN(deathYear)) {
          return deathYear >= yearRange[0] && deathYear <= yearRange[1];
        }
        return false;
      });
    }
  }, [persons, yearRange, selectedYear]);

  // Group locations by place
  const locationGroups = useMemo(() => {
    const groups = new Map();

    filteredPersons.forEach((person) => {
      const places = [];
      
      if (person.place_of_birth) {
        places.push({
          place: person.place_of_birth,
          type: 'birth',
          person: person,
          year: person.date_of_birth ? new Date(person.date_of_birth).getFullYear() : null,
        });
      }
      
      if (person.place_of_death) {
        places.push({
          place: person.place_of_death,
          type: 'death',
          person: person,
          year: person.date_of_death ? new Date(person.date_of_death).getFullYear() : null,
        });
      }

      if (person.village_origin) {
        places.push({
          place: person.village_origin,
          type: 'origin',
          person: person,
          year: null,
        });
      }

      places.forEach((placeData) => {
        const key = placeData.place.toLowerCase().trim();
        const generation = personGenerations.get(placeData.person.person_id) || 0;
        
        if (!groups.has(key)) {
          groups.set(key, {
            place: placeData.place,
            coordinates: getCoordinates(placeData.place),
            persons: [],
            births: 0,
            deaths: 0,
            origins: 0,
            generations: new Set(),
          });
        }

        const group = groups.get(key);
        group.persons.push({ ...placeData.person, generation });
        group.generations.add(generation);
        if (placeData.type === 'birth') group.births++;
        if (placeData.type === 'death') group.deaths++;
        if (placeData.type === 'origin') group.origins++;
      });
    });

    return Array.from(groups.values()).filter((group) => group.coordinates !== null);
  }, [filteredPersons, personGenerations]);

  // Calculate center of map
  const mapCenter = useMemo(() => {
    if (locationGroups.length === 0) return [9.0820, 8.6753]; // Default to Nigeria center
    
    const coords = locationGroups.map((g) => g.coordinates);
    const avgLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    return [avgLat, avgLng];
  }, [locationGroups]);

  // Timeline playback effect
  useEffect(() => {
    if (!isPlaying || selectedYear === null) return;

    const interval = setInterval(() => {
      setSelectedYear((prev) => {
        if (prev >= yearRange[1]) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, selectedYear, yearRange, playbackSpeed]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography>Loading migration map...</Typography>
      </Box>
    );
  }

  if (locationGroups.length === 0) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No location data available
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Add place of birth, place of death, or village origin to persons to see them on the map.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            Family Migration Map
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Year Range Mode">
              <Chip
                label="Range"
                size="small"
                color={selectedYear === null ? 'primary' : 'default'}
                onClick={() => setSelectedYear(null)}
                clickable
              />
            </Tooltip>
            <Tooltip title="Timeline Mode">
              <Chip
                label="Timeline"
                size="small"
                color={selectedYear !== null ? 'primary' : 'default'}
                onClick={() => setSelectedYear(selectedYear || yearRange[0])}
                clickable
              />
            </Tooltip>
          </Box>
        </Box>

        {selectedYear !== null ? (
          // Timeline mode
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <IconButton
                size="small"
                onClick={() => setSelectedYear(Math.max(yearRange[0], selectedYear - 10))}
                disabled={selectedYear <= yearRange[0]}
              >
                <SkipPrevious />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setIsPlaying(!isPlaying)}
                color="primary"
              >
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setSelectedYear(Math.min(yearRange[1], selectedYear + 10))}
                disabled={selectedYear >= yearRange[1]}
              >
                <SkipNext />
              </IconButton>
              <Typography variant="body2" sx={{ flex: 1, textAlign: 'center' }}>
                Year: <strong>{selectedYear}</strong>
              </Typography>
            </Box>
            <Slider
              value={selectedYear}
              onChange={(e, newValue) => {
                setSelectedYear(newValue);
                setIsPlaying(false);
              }}
              min={yearRange[0]}
              max={yearRange[1]}
              valueLabelDisplay="auto"
              marks={[
                { value: yearRange[0], label: String(yearRange[0]) },
                { value: yearRange[1], label: String(yearRange[1]) },
              ]}
            />
            <Typography variant="caption" color="text.secondary">
              Showing {filteredPersons.length} persons active in {selectedYear}
            </Typography>
          </Box>
        ) : (
          // Range mode
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Showing {filteredPersons.length} persons from {yearRange[0]} to {yearRange[1]}
            </Typography>
            <Slider
              value={yearRange}
              onChange={(e, newValue) => setYearRange(newValue)}
              min={1800}
              max={new Date().getFullYear()}
              valueLabelDisplay="auto"
              marks={[
                { value: 1800, label: '1800' },
                { value: 1900, label: '1900' },
                { value: 2000, label: '2000' },
                { value: new Date().getFullYear(), label: 'Now' },
              ]}
            />
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={`${locationGroups.length} Locations`} size="small" />
          <Chip 
            label={`${locationGroups.reduce((sum, g) => sum + g.births, 0)} Births`} 
            size="small" 
            color="primary" 
          />
          <Chip 
            label={`${locationGroups.reduce((sum, g) => sum + g.deaths, 0)} Deaths`} 
            size="small" 
            color="secondary" 
          />
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              Generations:
            </Typography>
            {Array.from(new Set(Array.from(personGenerations.values()))).slice(0, 5).map((gen) => (
              <Chip
                key={gen}
                label={`G${gen}`}
                size="small"
                sx={{
                  backgroundColor: getGenerationColor(gen),
                  color: 'white',
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
            ))}
          </Box>
        </Box>
      </Paper>

      <Box sx={{ flex: 1, position: 'relative', minHeight: 400 }}>
        <MapContainer
          center={mapCenter}
          zoom={5}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {locationGroups.map((group, index) => {
            // Get dominant generation color (most common generation in this location)
            const generationsArray = Array.from(group.generations);
            const dominantGen = generationsArray.length > 0 
              ? generationsArray.reduce((a, b) => 
                  group.persons.filter(p => p.generation === a).length >= 
                  group.persons.filter(p => p.generation === b).length ? a : b
                )
              : 0;
            const markerColor = getGenerationColor(dominantGen);

            // Create custom colored icon
            const customIcon = L.divIcon({
              className: 'custom-marker',
              html: `<div style="
                background-color: ${markerColor};
                width: 20px;
                height: 20px;
                border-radius: 50%;
                border: 3px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              "></div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10],
            });

            return (
              <Marker key={index} position={group.coordinates} icon={customIcon}>
                <Popup>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {group.place}
                    </Typography>
                    <Typography variant="body2">
                      {group.persons.length} person{group.persons.length !== 1 ? 's' : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {group.births > 0 && (
                        <Chip label={`${group.births} Birth${group.births !== 1 ? 's' : ''}`} size="small" />
                      )}
                      {group.deaths > 0 && (
                        <Chip label={`${group.deaths} Death${group.deaths !== 1 ? 's' : ''}`} size="small" color="secondary" />
                      )}
                      {group.origins > 0 && (
                        <Chip label={`${group.origins} Origin${group.origins !== 1 ? 's' : ''}`} size="small" color="default" />
                      )}
                      <Chip 
                        label={`Gen ${dominantGen}`} 
                        size="small" 
                        sx={{ 
                          backgroundColor: markerColor, 
                          color: 'white',
                          fontWeight: 'bold'
                        }} 
                      />
                    </Box>
                    <Box sx={{ mt: 1 }}>
                      {group.persons.slice(0, 5).map((person) => (
                        <Typography key={person.person_id} variant="caption" display="block">
                          • {person.full_name || 'Unknown'} 
                          <Chip 
                            label={`G${person.generation}`} 
                            size="small" 
                            sx={{ 
                              ml: 0.5, 
                              height: 16, 
                              fontSize: '0.65rem',
                              backgroundColor: getGenerationColor(person.generation),
                              color: 'white'
                            }} 
                          />
                        </Typography>
                      ))}
                      {group.persons.length > 5 && (
                        <Typography variant="caption" color="text.secondary">
                          ... and {group.persons.length - 5} more
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </Box>
    </Box>
  );
};

export default MigrationMapView;

