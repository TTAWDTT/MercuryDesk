import React from 'react';
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
  const layoutForIndex = (index: number) => {
    // Editorial / magazine-like grid rhythm.
    if (index === 0) {
      return {
        gridColumn: { xs: '1 / -1', sm: '1 / -1', md: 'span 12', lg: 'span 8' },
      };
    }
    if (index === 1) {
      return {
        gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 6', lg: 'span 4' },
      };
    }
    if (index === 5 || index === 6) {
      return {
        gridColumn: { xs: '1 / -1', sm: '1 / -1', md: 'span 12', lg: 'span 6' },
      };
    }
    return {
      gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 6', lg: 'span 4' },
    };
  };

  if (loading || !contacts) {
      return (
        <Box p={{ xs: 2, md: 5 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(12, minmax(0, 1fr))',
                },
                gap: { xs: 2, md: 3 },
                alignItems: 'start',
              }}
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <Box key={i} sx={layoutForIndex(i)}>
                  <ContactSkeleton variant={i === 0 ? 'feature' : 'standard'} />
                </Box>
              ))}
            </Box>
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
        p={{ xs: 2, md: 5 }}
    >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(12, minmax(0, 1fr))',
            },
            gap: { xs: 2, md: 3 },
            gridAutoFlow: { md: 'row dense' },
            alignItems: 'start',
          }}
        >
          {contacts.map((contact, index) => (
            <Box key={contact.id} sx={layoutForIndex(index)}>
              <ContactCard
                contact={contact}
                onClick={onContactClick}
                index={index}
                variant={index === 0 ? 'feature' : 'standard'}
              />
            </Box>
          ))}
        </Box>
    </Box>
  );
};
