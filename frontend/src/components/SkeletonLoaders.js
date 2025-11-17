import React from 'react';
import { Box, Skeleton, Card, CardContent, Grid } from '@mui/material';

export const PersonDetailSkeleton = () => (
  <Box sx={{ p: 3 }}>
    <Grid container spacing={3}>
      <Grid item xs={12} md={4}>
        <Card>
          <Skeleton variant="rectangular" height={300} />
          <CardContent>
            <Skeleton variant="text" width="60%" height={40} />
            <Skeleton variant="text" width="40%" height={30} />
            <Skeleton variant="text" width="50%" height={30} />
            <Box sx={{ mt: 2 }}>
              <Skeleton variant="rectangular" width="100%" height={40} sx={{ mb: 1 }} />
              <Skeleton variant="rectangular" width="100%" height={40} />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={8}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Skeleton variant="text" width="30%" height={30} />
            <Box sx={{ mt: 2 }}>
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="90%" />
            </Box>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Skeleton variant="text" width="40%" height={30} />
            <Box sx={{ mt: 2 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} variant="rectangular" width="100%" height={60} sx={{ mb: 2 }} />
              ))}
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  </Box>
);

export const FamilyTreeSkeleton = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="rectangular" width="100%" height={60} sx={{ mb: 2 }} />
    <Skeleton variant="rectangular" width="100%" height={400} />
  </Box>
);

export const DashboardSkeleton = () => (
  <Box sx={{ p: 3 }}>
    <Skeleton variant="text" width="30%" height={50} sx={{ mb: 3 }} />
    <Grid container spacing={3}>
      {[1, 2, 3].map((i) => (
        <Grid item xs={12} sm={6} md={4} key={i}>
          <Card>
            <CardContent>
              <Skeleton variant="text" width="60%" height={30} />
              <Skeleton variant="text" width="40%" height={20} sx={{ mt: 1 }} />
              <Skeleton variant="rectangular" width="100%" height={100} sx={{ mt: 2 }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  </Box>
);

export const ListSkeleton = ({ count = 5 }) => (
  <Box>
    {Array.from({ length: count }).map((_, i) => (
      <Card key={i} sx={{ mb: 2 }}>
        <CardContent>
          <Skeleton variant="text" width="40%" height={30} />
          <Skeleton variant="text" width="60%" height={20} sx={{ mt: 1 }} />
        </CardContent>
      </Card>
    ))}
  </Box>
);

