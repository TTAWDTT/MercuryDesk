import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';
import SyncIcon from '@mui/icons-material/Sync';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useColorMode } from '../theme';
import { 
    ConnectedAccount, 
    User, 
    createAccount, 
    deleteAccount, 
    syncAccount, 
    uploadAvatar
} from '../api';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { TopBar } from './TopBar';

interface SettingsProps {
    onLogout: () => void;
}

export default function Settings({ onLogout }: SettingsProps) {
    const navigate = useNavigate();
    const { mode, toggleColorMode } = useColorMode();
    const { data: user, mutate: mutateUser } = useSWR<User>('/api/v1/auth/me');
    const { data: accounts, mutate: mutateAccounts } = useSWR<ConnectedAccount[]>('/api/v1/accounts');
    
    const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
    const [syncing, setSyncing] = useState<number | null>(null);
    
    // Profile State
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [updatingProfile, setUpdatingProfile] = useState(false);

    // Account State
    const [newIdentifier, setNewIdentifier] = useState('');
    const [newProvider, setNewProvider] = useState<'mock' | 'github' | 'imap'>('mock');
    const [newToken, setNewToken] = useState('');
    const [imapHost, setImapHost] = useState('');
    const [imapPort, setImapPort] = useState('993');
    const [imapUseSsl, setImapUseSsl] = useState(true);
    const [imapUsername, setImapUsername] = useState('');
    const [imapPassword, setImapPassword] = useState('');
    const [imapMailbox, setImapMailbox] = useState('INBOX');
    const [addingAccount, setAddingAccount] = useState(false);

    useEffect(() => {
        if (!avatarFile) {
            setAvatarPreview(null);
            return;
        }
        const url = URL.createObjectURL(avatarFile);
        setAvatarPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [avatarFile]);

    const handleUploadAvatar = async () => {
        if (!avatarFile) return;
        setUpdatingProfile(true);
        try {
            const updated = await uploadAvatar(avatarFile);
            setToast({ message: 'Avatar uploaded', severity: 'success' });
            mutateUser(updated, { revalidate: false });
            setAvatarFile(null);
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : 'Failed to upload avatar', severity: 'error' });
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleAddAccount = async () => {
        setAddingAccount(true);
        try {
            const provider = newProvider;
            const identifier = newIdentifier.trim() || (provider === 'mock' ? 'demo' : provider === 'github' ? 'me' : imapUsername.trim());

            if (provider === 'imap') {
                const host = imapHost.trim();
                const username = imapUsername.trim() || identifier;
                if (!host || !username || !imapPassword) {
                    throw new Error('IMAP requires host, username and password');
                }
                const port = Number(imapPort || 993);
                await createAccount({
                    provider,
                    identifier: identifier || username,
                    imap_host: host,
                    imap_port: Number.isFinite(port) ? port : 993,
                    imap_use_ssl: imapUseSsl,
                    imap_username: username,
                    imap_password: imapPassword,
                    imap_mailbox: (imapMailbox || 'INBOX').trim(),
                });
            } else {
                await createAccount({
                    provider,
                    identifier,
                    access_token: provider === 'github' ? newToken : 'x'
                });
            }
            setToast({ message: 'Account connected', severity: 'success' });
            mutateAccounts();
            setNewIdentifier('');
            setNewToken('');
            setImapPassword('');
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : 'Failed to connect account', severity: 'error' });
        } finally {
            setAddingAccount(false);
        }
    };

    const handleDeleteAccount = async (id: number) => {
        if (!confirm('Are you sure you want to disconnect this account?')) return;
        try {
            await deleteAccount(id);
            setToast({ message: 'Account disconnected', severity: 'success' });
            mutateAccounts();
        } catch (e) {
            setToast({ message: 'Failed to disconnect', severity: 'error' });
        }
    };

    const handleSync = async (id: number) => {
        setSyncing(id);
        try {
            const res = await syncAccount(id);
            setToast({ message: `Synced +${res.inserted} items`, severity: 'success' });
            mutateAccounts(); // Update last synced time
        } catch (e) {
            setToast({ message: 'Sync failed', severity: 'error' });
        } finally {
            setSyncing(null);
        }
    };

    return (
        <Box 
            component={motion.div}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            sx={{ minHeight: '100vh', bgcolor: 'background.default' }}
        >
            <TopBar 
                onLogout={onLogout} 
                onRefresh={() => {}} 
                onSearch={() => {}} 
                loading={false} 
            />

            <Container maxWidth="md" sx={{ py: 6 }}>
                <Box mb={4} display="flex" alignItems="center">
                    <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" fontWeight="bold">Settings</Typography>
                </Box>

                <Grid container spacing={4}>
                    {/* Profile Section */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 4 }}>
                            <Typography variant="h6" gutterBottom>Profile</Typography>
                            <Box display="flex" alignItems="center" gap={3} mb={3}>
                                <Avatar 
                                    src={avatarPreview || user?.avatar_url || undefined} 
                                    sx={{ width: 80, height: 80, bgcolor: 'primary.main', fontSize: 32 }}
                                >
                                    {user?.email?.[0]?.toUpperCase()}
                                </Avatar>
                                <Box flexGrow={1}>
                                    <Typography variant="subtitle1" fontWeight="bold">{user?.email}</Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        Member since {user?.created_at ? new Date(user.created_at).getFullYear() : '...'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                                <Button variant="outlined" component="label" disabled={updatingProfile}>
                                    Choose image
                                    <input
                                        hidden
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                                    />
                                </Button>
                                <Typography variant="body2" color="textSecondary" sx={{ flexGrow: 1, minWidth: 180 }}>
                                    {avatarFile ? avatarFile.name : 'No file selected'}
                                </Typography>
                                <Button 
                                    variant="contained" 
                                    disabled={!avatarFile || updatingProfile}
                                    onClick={handleUploadAvatar}
                                >
                                    Upload
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Appearance */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box>
                                <Typography variant="h6">Appearance</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Switch between light and dark themes
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" color={mode === 'light' ? 'primary' : 'textSecondary'}>Light</Typography>
                                <Switch checked={mode === 'dark'} onChange={toggleColorMode} />
                                <Typography variant="body2" color={mode === 'dark' ? 'primary' : 'textSecondary'}>Dark</Typography>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Connected Accounts */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 4 }}>
                            <Typography variant="h6" gutterBottom>Connected Accounts</Typography>
                            <Typography variant="body2" color="textSecondary" mb={3}>
                                Manage your message sources. We currently support Mock (Demo), GitHub, and IMAP.
                            </Typography>
                            
                            <List>
                                {accounts?.map((account) => (
                                    <React.Fragment key={account.id}>
                                        <ListItem
                                            secondaryAction={
                                                <Box>
                                                    <IconButton 
                                                        edge="end" 
                                                        onClick={() => handleSync(account.id)} 
                                                        disabled={syncing === account.id}
                                                        sx={{ mr: 1 }}
                                                    >
                                                        {syncing === account.id ? <CircularProgress size={20} /> : <SyncIcon />}
                                                    </IconButton>
                                                    <IconButton edge="end" onClick={() => handleDeleteAccount(account.id)} color="error">
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Box>
                                            }
                                        >
                                            <ListItemAvatar>
                                                <Avatar sx={{ bgcolor: 'action.hover', color: 'text.primary' }}>
                                                    {account.provider === 'github' ? <GitHubIcon /> : <EmailIcon />}
                                                </Avatar>
                                            </ListItemAvatar>
                                            <ListItemText 
                                                primary={account.identifier}
                                                secondary={`Provider: ${account.provider} • Last synced: ${account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : 'Never'}`}
                                            />
                                        </ListItem>
                                        <Divider variant="inset" component="li" />
                                    </React.Fragment>
                                ))}
                            </List>

                            <Box mt={4} p={3} bgcolor="action.hover" borderRadius={4}>
                                <Typography variant="subtitle2" fontWeight="bold" mb={2}>Connect New Account</Typography>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid size={{ xs: 12, sm: 3 }}>
                                        <TextField
                                            select
                                            fullWidth
                                            size="small"
                                            label="Provider"
                                            value={newProvider}
                                            onChange={(e) => setNewProvider(e.target.value as any)}
                                            SelectProps={{ native: true }}
                                        >
                                            <option value="mock">Mock (Demo)</option>
                                            <option value="github">GitHub</option>
                                            <option value="imap">IMAP (Email)</option>
                                        </TextField>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField 
                                            fullWidth 
                                            size="small" 
                                            label={newProvider === 'imap' ? 'Account Email' : 'Identifier (Email/User)'} 
                                            value={newIdentifier}
                                            onChange={(e) => setNewIdentifier(e.target.value)}
                                        />
                                    </Grid>
                                    {newProvider === 'imap' && (
                                        <>
                                            <Grid size={{ xs: 12, sm: 5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="IMAP Host"
                                                    placeholder="imap.gmail.com"
                                                    value={imapHost}
                                                    onChange={(e) => setImapHost(e.target.value)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 2 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Port"
                                                    value={imapPort}
                                                    onChange={(e) => setImapPort(e.target.value)}
                                                    inputProps={{ inputMode: 'numeric' }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 1 }}>
                                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                                    <Typography variant="caption" color="textSecondary">
                                                        SSL
                                                    </Typography>
                                                    <Switch
                                                        checked={imapUseSsl}
                                                        onChange={(e) => setImapUseSsl(e.target.checked)}
                                                        size="small"
                                                    />
                                                </Box>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 5 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="IMAP Username"
                                                    placeholder="your@email.com"
                                                    value={imapUsername}
                                                    onChange={(e) => setImapUsername(e.target.value)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="IMAP Password"
                                                    type="password"
                                                    value={imapPassword}
                                                    onChange={(e) => setImapPassword(e.target.value)}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 3 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Mailbox"
                                                    placeholder="INBOX"
                                                    value={imapMailbox}
                                                    onChange={(e) => setImapMailbox(e.target.value)}
                                                />
                                            </Grid>
                                        </>
                                    )}
                                    {newProvider === 'github' && (
                                        <Grid size={{ xs: 12, sm: 3 }}>
                                            <TextField 
                                                fullWidth 
                                                size="small" 
                                                label="Access Token" 
                                                type="password"
                                                value={newToken}
                                                onChange={(e) => setNewToken(e.target.value)}
                                            />
                                        </Grid>
                                    )}
                                    <Grid size={{ xs: 12, sm: 2 }}>
                                        <Button 
                                            fullWidth 
                                            variant="contained" 
                                            onClick={handleAddAccount}
                                            disabled={addingAccount}
                                        >
                                            Add
                                        </Button>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

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
            </Container>
        </Box>
    );
}
