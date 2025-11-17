import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, CircularProgress } from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import { format } from 'date-fns';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const TimelineView = ({ familyId }) => {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTimeline = async () => {
    if (!familyId) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all persons in the family
      const personsRef = collection(db, 'persons');
      const personsQuery = query(personsRef, where('family_id', '==', familyId));
      const personsSnap = await getDocs(personsQuery);

      const events = [];

      personsSnap.docs.forEach((docSnap) => {
        const person = { person_id: docSnap.id, ...docSnap.data() };

        // Add birth event
        if (person.date_of_birth) {
          events.push({
            full_name: person.full_name || 'Unknown',
            event_type: 'birth',
            event_date: person.date_of_birth,
            location: person.place_of_birth || null,
            person_id: person.person_id,
          });
        }

        // Add death event
        if (person.date_of_death) {
          events.push({
            full_name: person.full_name || 'Unknown',
            event_type: 'death',
            event_date: person.date_of_death,
            location: person.place_of_death || null,
            person_id: person.person_id,
          });
        }
      });

      // Sort events by date (oldest first)
      events.sort((a, b) => {
        const dateA = new Date(a.event_date);
        const dateB = new Date(b.event_date);
        return dateA - dateB;
      });

      setTimelineData(events);
    } catch (error) {
      console.error('Failed to fetch timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (timelineData.length === 0) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6">No timeline events found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Family Timeline
      </Typography>
      <Timeline>
        {timelineData.map((event, index) => (
          <TimelineItem key={index}>
            <TimelineSeparator>
              <TimelineDot color={event.event_type === 'birth' ? 'primary' : 'grey'} />
              {index < timelineData.length - 1 && <TimelineConnector />}
            </TimelineSeparator>
            <TimelineContent>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="div">
                    {event.full_name}
                  </Typography>
                  <Typography color="text.secondary">
                    {event.event_type === 'birth' ? 'Born' : 'Died'}
                  </Typography>
                  <Typography variant="body2">
                    {format(new Date(event.event_date), 'MMMM d, yyyy')}
                  </Typography>
                  {event.location && (
                    <Typography variant="body2" color="text.secondary">
                      {event.location}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );
};

export default TimelineView;

