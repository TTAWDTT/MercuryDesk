import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import { TopBar } from './TopBar';
import { ContactGrid } from './ContactGrid';
import { ConversationDrawer } from './ConversationDrawer';
import { GuideCards } from './GuideCards';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Contact, ConnectedAccount, createAccount, syncAccount } from '../api';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const navigate = useNavigate();
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

  const handleSyncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      let list = accounts ?? [];
      if (list.length === 0) {
        const mockAccount = await createAccount({
          provider: 'mock',
          identifier: 'demo',
          access_token: 'x',
        });
        list = [mockAccount];
      }

      const results = await Promise.allSettled(list.map((a) => syncAccount(a.id)));
      const inserted = results.reduce((sum, r) => (r.status === 'fulfilled' ? sum + r.value.inserted : sum), 0);
      const failed = results.filter((r) => r.status === 'rejected').length;
      const message =
        failed === 0 ? `同步完成：+${inserted}` : `同步完成：+${inserted}（失败 ${failed} 个）`;
      setToast({ message, severity: failed === 0 ? 'success' : 'error' });

      await Promise.all([mutateContacts(), mutateAccounts()]);
    } catch (e) {
      setToast({ message: e instanceof Error ? e.message : '同步失败', severity: 'error' });
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
        onRefresh={handleSyncAll} 
        onSearch={setSearchQuery} 
        loading={syncing}
      />
      
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper 
          elevation={0}
          sx={{ 
            borderRadius: '20px', 
            bgcolor: 'background.paper',
            minHeight: '70vh',
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'hidden'
          }}
        >
          <Box p={{ xs: 2, md: 2.5 }}>
            <GuideCards
              hasAccounts={!!accounts?.length}
              syncing={syncing}
              onOpenSettings={() => navigate('/settings')}
              onSync={handleSyncAll}
            />
          </Box>
          <Divider />
          <ContactGrid 
            contacts={contacts} 
            loading={!contacts}
            onContactClick={setSelectedContact} 
          />
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
