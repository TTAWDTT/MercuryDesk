import React from 'react';
import Grid from '@mui/material/Grid';
import { Contact } from '../api';
import { ContactCard } from './ContactCard';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { motion } from 'framer-motion';

interface ContactGridProps {
  contacts: Contact[];
  onContactClick: (contact: Contact) => void;
}

export const ContactGrid: React.FC<ContactGridProps> = ({ contacts, onContactClick }) => {
  if (contacts.length === 0) {
    return (
      <Box 
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
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
    <Box p={{ xs: 2, md: 4 }}>
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