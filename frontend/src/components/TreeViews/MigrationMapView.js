import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Box, Typography, Paper, Slider, Chip } from '@mui/material';
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
  const [loading, setLoading] = useState(true);
  const [yearRange, setYearRange] = useState([1800, new Date().getFullYear()]);

  useEffect(() => {
    fetchPersons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  const fetchPersons = async () => {
    try {
      setLoading(true);
      const personsRef = collection(db, 'persons');
      const personsQuery = query(personsRef, where('family_id', '==', familyId));
      const snap = await getDocs(personsQuery);

      const personsList = snap.docs.map((docSnap) => ({
        person_id: docSnap.id,
        ...docSnap.data(),
      }));

      setPersons(personsList);

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
        setYearRange([Math.max(1800, minYear - 10), Math.min(new Date().getFullYear(), maxYear + 10)]);
      }
    } catch (error) {
      console.error('Failed to fetch persons:', error);
    } finally {
      setLoading(false);
    }
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

  // Filter persons by year range
  const filteredPersons = useMemo(() => {
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
  }, [persons, yearRange]);

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
        if (!groups.has(key)) {
          groups.set(key, {
            place: placeData.place,
            coordinates: getCoordinates(placeData.place),
            persons: [],
            births: 0,
            deaths: 0,
            origins: 0,
          });
        }

        const group = groups.get(key);
        group.persons.push(placeData.person);
        if (placeData.type === 'birth') group.births++;
        if (placeData.type === 'death') group.deaths++;
        if (placeData.type === 'origin') group.origins++;
      });
    });

    return Array.from(groups.values()).filter((group) => group.coordinates !== null);
  }, [filteredPersons]);

  // Calculate center of map
  const mapCenter = useMemo(() => {
    if (locationGroups.length === 0) return [9.0820, 8.6753]; // Default to Nigeria center
    
    const coords = locationGroups.map((g) => g.coordinates);
    const avgLat = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLng = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    return [avgLat, avgLng];
  }, [locationGroups]);

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
        <Typography variant="h6" gutterBottom>
          Family Migration Map
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {filteredPersons.length} persons from {yearRange[0]} to {yearRange[1]}
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Year Range: {yearRange[0]} - {yearRange[1]}
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

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
          
          {locationGroups.map((group, index) => (
            <Marker key={index} position={group.coordinates}>
              <Popup>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {group.place}
                  </Typography>
                  <Typography variant="body2">
                    {group.persons.length} person{group.persons.length !== 1 ? 's' : ''}
                  </Typography>
                  {group.births > 0 && (
                    <Chip label={`${group.births} Birth${group.births !== 1 ? 's' : ''}`} size="small" sx={{ mt: 0.5, mr: 0.5 }} />
                  )}
                  {group.deaths > 0 && (
                    <Chip label={`${group.deaths} Death${group.deaths !== 1 ? 's' : ''}`} size="small" sx={{ mt: 0.5, mr: 0.5 }} color="secondary" />
                  )}
                  {group.origins > 0 && (
                    <Chip label={`${group.origins} Origin${group.origins !== 1 ? 's' : ''}`} size="small" sx={{ mt: 0.5, mr: 0.5 }} color="default" />
                  )}
                  <Box sx={{ mt: 1 }}>
                    {group.persons.slice(0, 5).map((person) => (
                      <Typography key={person.person_id} variant="caption" display="block">
                        • {person.full_name || 'Unknown'}
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
          ))}
        </MapContainer>
      </Box>
    </Box>
  );
};

export default MigrationMapView;

