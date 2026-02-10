import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';

export const ContactSkeleton: React.FC<{ variant?: 'standard' | 'feature' }> = ({ variant = 'standard' }) => {
  const isFeature = variant === 'feature';

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isFeature ? { xs: 3.5, md: 4 } : { xs: 3, md: 3.5 } }}>
        <Box display="flex" alignItems="center" mb={isFeature ? 3 : 2.5}>
          <Skeleton variant="rounded" width={isFeature ? 72 : 60} height={isFeature ? 72 : 60} sx={{ borderRadius: 0 }} />
          <Box ml={2} flexGrow={1}>
            <Skeleton variant="text" width="60%" height={isFeature ? 40 : 32} />
            <Skeleton variant="text" width="45%" height={22} />
          </Box>
        </Box>
        <Box sx={{ minHeight: isFeature ? 92 : 72, mb: isFeature ? 2.5 : 2 }}>
           <Skeleton variant="text" width="92%" height={28} />
           <Skeleton variant="text" width="100%" height={22} />
           <Skeleton variant="text" width={isFeature ? "96%" : "80%"} height={22} />
           {isFeature && <Skeleton variant="text" width="78%" height={22} />}
        </Box>
        <Box display="flex" justifyContent="space-between">
           <Skeleton variant="rounded" width={60} height={24} />
           <Skeleton variant="text" width={40} />
        </Box>
      </CardContent>
    </Card>
  );
};
