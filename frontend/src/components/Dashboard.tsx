import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { TopBar } from './TopBar';
import { ContactGrid } from './ContactGrid';
import { ConversationDrawer } from './ConversationDrawer';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Contact, ConnectedAccount, createAccount, syncAccount } from '../api';
import { motion } from 'framer-motion';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const contactsKey = useMemo(() => {
    const qs = new URLSearchParams();
    if (debouncedQuery) qs.set('q', debouncedQuery);
    qs.set('limit', '200');
    return `/api/v1/contacts?${qs.toString()}`;
  }, [debouncedQuery]);

  const { data: contacts, mutate: mutateContacts } = useSWR<Contact[]>(contactsKey);
  const { data: accounts, mutate: mutateAccounts } = useSWR<ConnectedAccount[]>('/api/v1/accounts');

  const handleSyncDemo = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const list = accounts ?? [];
      let mockAccount = list.find((a) => a.provider === 'mock');
      
      if (!mockAccount) {
        mockAccount = await createAccount({
          provider: 'mock',
          identifier: 'demo',
          access_token: 'x',
        });
      }

      const result = await syncAccount(mockAccount.id);
      setToast({ message: `Synced ${result.inserted} new messages`, severity: 'success' });
      await Promise.all([mutateContacts(), mutateAccounts()]);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : 'Sync failed', severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box 
        component={motion.div}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4 }}
        sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}
    >
      <TopBar 
        onLogout={onLogout} 
        onRefresh={handleSyncDemo} 
        onSearch={setSearchQuery} 
        loading={syncing}
      />
      
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper 
          elevation={0}
          sx={{ 
            borderRadius: '24px', 
            bgcolor: 'background.paper',
            minHeight: '70vh',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden'
          }}
        >
          <Box p={{ xs: 1, md: 2 }}>
            <ContactGrid 
              contacts={contacts} 
              loading={!contacts}
              onContactClick={setSelectedContact} 
            />
          </Box>
        </Paper>
      </Container>

      <ConversationDrawer 
        open={!!selectedContact} 
        contact={selectedContact} 
        onClose={() => {
            setSelectedContact(null);
            mutateContacts(); // Refresh to update unread counts
        }} 
      />

      <Snackbar 
        open={!!toast} 
        autoHideDuration={4000} 
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
