import React from 'react';
import Grid from '@mui/material/Grid';
import { Contact } from '../api';
import { ContactCard } from './ContactCard';
import { ContactSkeleton } from './ContactSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { motion } from 'framer-motion';

interface ContactGridProps {
  contacts: Contact[] | undefined;
  onContactClick: (contact: Contact) => void;
  loading?: boolean;
}

export const ContactGrid: React.FC<ContactGridProps> = ({ contacts, onContactClick, loading }) => {
  if (loading || !contacts) {
      return (
        <Box p={{ xs: 2, md: 4 }}>
            <Grid container spacing={3}>
                {Array.from({ length: 8 }).map((_, i) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} xl={2.4} key={i}>
                        <ContactSkeleton />
                    </Grid>
                ))}
            </Grid>
        </Box>
      );
  }

  if (contacts.length === 0) {
    return (
      <Box 
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        textAlign="center" 
        mt={15}
      >
        <Typography variant="h4" color="textSecondary" fontWeight="bold" gutterBottom>
           It's quiet here.
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 400, mx: 'auto' }}>
          Try syncing your accounts to see messages from your network aggregated here.
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        p={{ xs: 2, md: 4 }}
    >
        <Grid container spacing={3}>
            {contacts.map((contact, index) => (
            <Grid item xs={12} sm={6} md={4} lg={3} xl={2.4} key={contact.id}>
                <ContactCard contact={contact} onClick={onContactClick} index={index} />
            </Grid>
            ))}
        </Grid>
    </Box>
  );
};