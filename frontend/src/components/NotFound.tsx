import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={3}
    >
      <Typography variant="h1" fontWeight={900} sx={{ fontSize: { xs: '4rem', md: '6rem' } }}>
        404
      </Typography>
      <Typography variant="h5" color="text.secondary">
        页面不存在
      </Typography>
      <Button variant="contained" onClick={() => navigate('/')}>
        返回首页
      </Button>
    </Box>
  );
}
