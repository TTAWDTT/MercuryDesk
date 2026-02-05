import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

export const ContactSkeleton: React.FC = () => {
  return (
    <Card sx={{ height: '100%', borderRadius: 5 }}>
      <CardContent sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" mb={2.5}>
          <Skeleton variant="circular" width={52} height={52} />
          <Box ml={2} flexGrow={1}>
            <Skeleton variant="text" width="60%" height={32} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
        </Box>
        <Box sx={{ minHeight: 64, mb: 2 }}>
           <Skeleton variant="text" width="90%" height={24} />
           <Skeleton variant="text" width="100%" height={20} />
           <Skeleton variant="text" width="80%" height={20} />
        </Box>
        <Box display="flex" justifyContent="space-between">
           <Skeleton variant="rounded" width={60} height={24} />
           <Skeleton variant="text" width={40} />
        </Box>
      </CardContent>
    </Card>
  );
};
