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
import Collapse from '@mui/material/Collapse';
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
    AgentConfig,
    ConnectedAccount, 
    User, 
    createAccount, 
    deleteAccount, 
    testAgent,
    updateAgentConfig,
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
    const { data: agentConfig, mutate: mutateAgentConfig } = useSWR<AgentConfig>('/api/v1/agent/config');
    
    const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
    const [syncing, setSyncing] = useState<number | null>(null);
    
    // Profile State
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [updatingProfile, setUpdatingProfile] = useState(false);

    // Account State
    const [newIdentifier, setNewIdentifier] = useState('');
    const [newProvider, setNewProvider] = useState<'mock' | 'github' | 'imap'>('imap');
    const [newToken, setNewToken] = useState('');
    const [imapPreset, setImapPreset] = useState<'gmail' | 'outlook' | 'icloud' | 'qq' | '163' | 'custom'>('gmail');
    const [showImapAdvanced, setShowImapAdvanced] = useState(false);
    const [imapHost, setImapHost] = useState('');
    const [imapPort, setImapPort] = useState('993');
    const [imapUseSsl, setImapUseSsl] = useState(true);
    const [imapUsername, setImapUsername] = useState('');
    const [imapPassword, setImapPassword] = useState('');
    const [imapMailbox, setImapMailbox] = useState('INBOX');
    const [addingAccount, setAddingAccount] = useState(false);

    // Agent State
    const [agentProvider, setAgentProvider] = useState<'rule_based' | 'openai'>('rule_based');
    const [agentBaseUrl, setAgentBaseUrl] = useState('https://api.openai.com/v1');
    const [agentModel, setAgentModel] = useState('gpt-4o-mini');
    const [agentTemperature, setAgentTemperature] = useState(0.2);
    const [agentApiKey, setAgentApiKey] = useState('');
    const [savingAgent, setSavingAgent] = useState(false);
    const [testingAgent, setTestingAgent] = useState(false);

    useEffect(() => {
        if (!avatarFile) {
            setAvatarPreview(null);
            return;
        }
        const url = URL.createObjectURL(avatarFile);
        setAvatarPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [avatarFile]);

    useEffect(() => {
        if (newProvider !== 'imap') return;
        const presets = {
            gmail: { host: 'imap.gmail.com', port: 993, ssl: true },
            outlook: { host: 'outlook.office365.com', port: 993, ssl: true },
            icloud: { host: 'imap.mail.me.com', port: 993, ssl: true },
            qq: { host: 'imap.qq.com', port: 993, ssl: true },
            '163': { host: 'imap.163.com', port: 993, ssl: true },
            custom: { host: '', port: 993, ssl: true },
        } as const;

        if (imapPreset === 'custom') {
            setShowImapAdvanced(true);
            setImapHost('');
            setImapPort('993');
            setImapUseSsl(true);
            return;
        }

        const preset = presets[imapPreset];
        setImapHost(preset.host);
        setImapPort(String(preset.port));
        setImapUseSsl(preset.ssl);
    }, [newProvider, imapPreset]);

    useEffect(() => {
        if (!agentConfig) return;
        const provider = (agentConfig.provider || 'rule_based').toLowerCase().includes('openai') ? 'openai' : 'rule_based';
        setAgentProvider(provider);
        setAgentBaseUrl(agentConfig.base_url || 'https://api.openai.com/v1');
        setAgentModel(agentConfig.model || 'gpt-4o-mini');
        setAgentTemperature(Number.isFinite(agentConfig.temperature) ? agentConfig.temperature : 0.2);
    }, [agentConfig]);

    const handleUploadAvatar = async () => {
        if (!avatarFile) return;
        setUpdatingProfile(true);
        try {
            const updated = await uploadAvatar(avatarFile);
            setToast({ message: '头像已上传', severity: 'success' });
            mutateUser(updated, { revalidate: false });
            setAvatarFile(null);
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : '头像上传失败', severity: 'error' });
        } finally {
            setUpdatingProfile(false);
        }
    };

    const handleSaveAgent = async () => {
        setSavingAgent(true);
        try {
            const payload: any = {
                provider: agentProvider,
                base_url: agentBaseUrl.trim(),
                model: agentModel.trim(),
                temperature: agentTemperature,
            };
            if (agentProvider === 'openai' && agentApiKey.trim()) payload.api_key = agentApiKey.trim();

            const updated = await updateAgentConfig(payload);
            mutateAgentConfig(updated, { revalidate: false });
            setAgentApiKey('');
            setToast({ message: 'AI 助手配置已保存', severity: 'success' });
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : '保存失败', severity: 'error' });
        } finally {
            setSavingAgent(false);
        }
    };

    const handleTestAgent = async () => {
        setTestingAgent(true);
        try {
            const res = await testAgent();
            setToast({ message: `测试通过：${res.message || 'OK'}`, severity: 'success' });
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : '测试失败', severity: 'error' });
        } finally {
            setTestingAgent(false);
        }
    };

    const handleAddAccount = async () => {
        setAddingAccount(true);
        try {
            const provider = newProvider;

            if (provider === 'imap') {
                const email = imapUsername.trim();
                const host = imapHost.trim();
                const mailbox = (imapMailbox || 'INBOX').trim();
                if (!email || !imapPassword) {
                    throw new Error('请填写邮箱与授权码/密码');
                }
                if (!host) {
                    throw new Error('请先选择邮箱服务商，或在高级设置里填写 IMAP 主机');
                }
                const port = Number(imapPort || 993);
                const account = await createAccount({
                    provider,
                    identifier: email,
                    imap_host: host,
                    imap_port: Number.isFinite(port) ? port : 993,
                    imap_use_ssl: imapUseSsl,
                    imap_username: email,
                    imap_password: imapPassword,
                    imap_mailbox: mailbox,
                });
                try {
                    const res = await syncAccount(account.id);
                    setToast({ message: `邮箱已连接，同步完成：+${res.inserted}`, severity: 'success' });
                } catch (e) {
                    setToast({
                        message: e instanceof Error ? `邮箱已连接，但同步失败：${e.message}` : '邮箱已连接，但同步失败',
                        severity: 'error',
                    });
                }
            } else if (provider === 'github') {
                const identifier = newIdentifier.trim() || 'me';
                if (!newToken.trim()) throw new Error('请填写 GitHub Token');
                const account = await createAccount({
                    provider,
                    identifier,
                    access_token: newToken.trim(),
                });
                try {
                    const res = await syncAccount(account.id);
                    setToast({ message: `GitHub 已连接，同步完成：+${res.inserted}`, severity: 'success' });
                } catch (e) {
                    setToast({
                        message: e instanceof Error ? `GitHub 已连接，但同步失败：${e.message}` : 'GitHub 已连接，但同步失败',
                        severity: 'error',
                    });
                }
            } else {
                const account = await createAccount({
                    provider: 'mock',
                    identifier: 'demo',
                    access_token: 'x',
                });
                const res = await syncAccount(account.id);
                setToast({ message: `演示账户已连接，同步完成：+${res.inserted}`, severity: 'success' });
            }
            mutateAccounts();
            setNewIdentifier('');
            setNewToken('');
            setImapPassword('');
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : '连接失败', severity: 'error' });
        } finally {
            setAddingAccount(false);
        }
    };

    const handleDeleteAccount = async (id: number) => {
        if (!confirm('确定要断开该账户吗？')) return;
        try {
            await deleteAccount(id);
            setToast({ message: '已断开连接', severity: 'success' });
            mutateAccounts();
        } catch (e) {
            setToast({ message: '断开失败', severity: 'error' });
        }
    };

    const handleSync = async (id: number) => {
        setSyncing(id);
        try {
            const res = await syncAccount(id);
            setToast({ message: `同步完成：+${res.inserted}`, severity: 'success' });
            mutateAccounts(); // Update last synced time
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : '同步失败', severity: 'error' });
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
                hideSearch
                hideSync
            />

            <Container maxWidth="md" sx={{ py: 6 }}>
                <Box mb={4} display="flex" alignItems="center">
                    <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h4" fontWeight="bold">设置</Typography>
                </Box>

                <Grid container spacing={4}>
                    {/* Profile Section */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 4 }}>
                            <Typography variant="h6" gutterBottom>个人资料</Typography>
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
                                        注册于 {user?.created_at ? new Date(user.created_at).getFullYear() : '...'}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
                                <Button variant="outlined" component="label" disabled={updatingProfile}>
                                    选择图片
                                    <input
                                        hidden
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                                    />
                                </Button>
                                <Typography variant="body2" color="textSecondary" sx={{ flexGrow: 1, minWidth: 180 }}>
                                    {avatarFile ? avatarFile.name : '未选择文件'}
                                </Typography>
                                <Button 
                                    variant="contained" 
                                    disabled={!avatarFile || updatingProfile}
                                    onClick={handleUploadAvatar}
                                >
                                    上传头像
                                </Button>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Appearance */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box>
                                <Typography variant="h6">外观</Typography>
                                <Typography variant="body2" color="textSecondary">
                                    切换浅色 / 深色主题
                                </Typography>
                            </Box>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" color={mode === 'light' ? 'primary' : 'textSecondary'}>浅色</Typography>
                                <Switch checked={mode === 'dark'} onChange={toggleColorMode} />
                                <Typography variant="body2" color={mode === 'dark' ? 'primary' : 'textSecondary'}>深色</Typography>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Connected Accounts */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 4 }}>
                            <Typography variant="h6" gutterBottom>已连接账户</Typography>
                            <Typography variant="body2" color="textSecondary" mb={3}>
                                管理你的消息来源。目前支持：演示（Mock）、GitHub、邮箱（IMAP）。
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
                                                secondary={`类型：${account.provider} • 上次同步：${account.last_synced_at ? new Date(account.last_synced_at).toLocaleString() : '从未'}`}
                                            />
                                        </ListItem>
                                        <Divider variant="inset" component="li" />
                                    </React.Fragment>
                                ))}
                            </List>

                            <Box mt={4} p={3} bgcolor="action.hover" borderRadius={4}>
                                <Typography variant="subtitle2" fontWeight="bold" mb={0.5}>连接新账户</Typography>
                                <Typography variant="caption" color="textSecondary">
                                    选择一个来源并一键连接；连接成功后会自动尝试同步一次以验证配置。
                                </Typography>

                                <Box mt={2.5}>
                                    <Grid container spacing={2} alignItems="center">
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <TextField
                                                select
                                                fullWidth
                                                size="small"
                                                label="来源类型"
                                                value={newProvider}
                                                onChange={(e) => setNewProvider(e.target.value as any)}
                                                SelectProps={{ native: true }}
                                            >
                                                <option value="imap">邮箱（IMAP）</option>
                                                <option value="github">GitHub 通知</option>
                                                <option value="mock">演示数据</option>
                                            </TextField>
                                        </Grid>

                                        {newProvider === 'github' && (
                                            <>
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <TextField 
                                                        fullWidth 
                                                        size="small" 
                                                        label="标识（可选）" 
                                                        value={newIdentifier}
                                                        onChange={(e) => setNewIdentifier(e.target.value)}
                                                        placeholder="me"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <TextField 
                                                        fullWidth 
                                                        size="small" 
                                                        label="GitHub Token" 
                                                        type="password"
                                                        value={newToken}
                                                        onChange={(e) => setNewToken(e.target.value)}
                                                        placeholder="ghp_..."
                                                    />
                                                </Grid>
                                            </>
                                        )}

                                        {newProvider === 'imap' && (
                                            <>
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <TextField
                                                        select
                                                        fullWidth
                                                        size="small"
                                                        label="邮箱服务商"
                                                        value={imapPreset}
                                                        onChange={(e) => setImapPreset(e.target.value as any)}
                                                        SelectProps={{ native: true }}
                                                    >
                                                        <option value="gmail">Gmail</option>
                                                        <option value="outlook">Outlook / Microsoft 365</option>
                                                        <option value="icloud">iCloud</option>
                                                        <option value="qq">QQ 邮箱</option>
                                                        <option value="163">163 邮箱</option>
                                                        <option value="custom">自定义</option>
                                                    </TextField>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <TextField 
                                                        fullWidth 
                                                        size="small" 
                                                        label="邮箱" 
                                                        value={imapUsername}
                                                        onChange={(e) => setImapUsername(e.target.value)}
                                                        placeholder="your@email.com"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="授权码 / 密码"
                                                        type="password"
                                                        value={imapPassword}
                                                        onChange={(e) => setImapPassword(e.target.value)}
                                                        placeholder="建议使用应用专用密码"
                                                    />
                                                </Grid>

                                                <Grid size={{ xs: 12 }}>
                                                    <Alert severity="info" sx={{ borderRadius: 3 }}>
                                                        Gmail / Outlook 通常需要“应用专用密码（App Password）”。若连接失败，请先确认：已开启 IMAP、账号已生成授权码、并使用正确的 IMAP 主机与端口。
                                                    </Alert>
                                                </Grid>

                                                <Grid size={{ xs: 12 }}>
                                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                                        <Typography variant="caption" color="textSecondary">
                                                            当前：{imapHost || '未设置主机'}:{imapPort}（{imapUseSsl ? 'SSL' : '无 SSL'}）
                                                        </Typography>
                                                        <Button
                                                            size="small"
                                                            variant="text"
                                                            onClick={() => setShowImapAdvanced((v) => !v)}
                                                        >
                                                            {showImapAdvanced ? '收起高级设置' : '高级设置'}
                                                        </Button>
                                                    </Box>
                                                    <Collapse in={showImapAdvanced}>
                                                        <Grid container spacing={2} sx={{ mt: 0.5 }}>
                                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                                <TextField
                                                                    fullWidth
                                                                    size="small"
                                                                    label="IMAP 主机"
                                                                    placeholder="imap.example.com"
                                                                    value={imapHost}
                                                                    onChange={(e) => setImapHost(e.target.value)}
                                                                />
                                                            </Grid>
                                                            <Grid size={{ xs: 12, sm: 3 }}>
                                                                <TextField
                                                                    fullWidth
                                                                    size="small"
                                                                    label="端口"
                                                                    value={imapPort}
                                                                    onChange={(e) => setImapPort(e.target.value)}
                                                                    inputProps={{ inputMode: 'numeric' }}
                                                                />
                                                            </Grid>
                                                            <Grid size={{ xs: 12, sm: 3 }}>
                                                                <Box display="flex" alignItems="center" justifyContent="space-between" height="100%">
                                                                    <Typography variant="body2" color="textSecondary">
                                                                        使用 SSL
                                                                    </Typography>
                                                                    <Switch
                                                                        checked={imapUseSsl}
                                                                        onChange={(e) => setImapUseSsl(e.target.checked)}
                                                                    />
                                                                </Box>
                                                            </Grid>
                                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                                <TextField
                                                                    fullWidth
                                                                    size="small"
                                                                    label="邮箱文件夹"
                                                                    placeholder="INBOX"
                                                                    value={imapMailbox}
                                                                    onChange={(e) => setImapMailbox(e.target.value)}
                                                                />
                                                            </Grid>
                                                        </Grid>
                                                    </Collapse>
                                                </Grid>
                                            </>
                                        )}

                                        {newProvider === 'mock' && (
                                            <Grid size={{ xs: 12 }}>
                                                <Alert severity="success" sx={{ borderRadius: 3 }}>
                                                    连接演示数据用于快速体验界面（不会访问真实邮箱）。
                                                </Alert>
                                            </Grid>
                                        )}

                                        <Grid size={{ xs: 12 }}>
                                            <Button 
                                                fullWidth 
                                                variant="contained" 
                                                onClick={handleAddAccount}
                                                disabled={addingAccount}
                                            >
                                                {addingAccount ? '连接中…' : '连接并同步'}
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Agent */}
                    <Grid size={{ xs: 12 }}>
                        <Paper sx={{ p: 4 }}>
                            <Typography variant="h6" gutterBottom>AI 助手</Typography>
                            <Typography variant="body2" color="textSecondary" mb={3}>
                                配置摘要与回复草拟。默认使用内置规则（不会调用外部 API）。
                            </Typography>

                            <Grid container spacing={2} alignItems="center">
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label="模式"
                                        value={agentProvider}
                                        onChange={(e) => setAgentProvider(e.target.value as any)}
                                        SelectProps={{ native: true }}
                                    >
                                        <option value="rule_based">内置规则（免费）</option>
                                        <option value="openai">OpenAI / 兼容接口</option>
                                    </TextField>
                                </Grid>

                                {agentProvider === 'openai' && (
                                    <>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="接口地址（Base URL）"
                                                value={agentBaseUrl}
                                                onChange={(e) => setAgentBaseUrl(e.target.value)}
                                                placeholder="https://api.openai.com/v1"
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="模型（Model）"
                                                value={agentModel}
                                                onChange={(e) => setAgentModel(e.target.value)}
                                                placeholder="gpt-4o-mini"
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                type="number"
                                                label="随机度（Temperature）"
                                                value={agentTemperature}
                                                onChange={(e) => setAgentTemperature(Number(e.target.value))}
                                                inputProps={{ min: 0, max: 2, step: 0.1 }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 8 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                type="password"
                                                label="API Key（可选：留空则沿用已保存的 Key）"
                                                value={agentApiKey}
                                                onChange={(e) => setAgentApiKey(e.target.value)}
                                                placeholder={agentConfig?.has_api_key ? '已保存（不显示）' : 'sk-...'}
                                                helperText="建议在后端设置 MERCURYDESK_FERNET_KEY 以加密保存。"
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Alert severity="warning" sx={{ borderRadius: 3 }}>
                                                该配置会保存在本地数据库中。不要在不可信机器上保存 API Key。
                                            </Alert>
                                        </Grid>
                                    </>
                                )}
                            </Grid>

                            <Box mt={2.5} display="flex" gap={2} flexWrap="wrap" justifyContent="flex-end">
                                <Button variant="outlined" onClick={handleTestAgent} disabled={testingAgent || savingAgent}>
                                    {testingAgent ? '测试中…' : '测试连接'}
                                </Button>
                                <Button variant="contained" onClick={handleSaveAgent} disabled={savingAgent}>
                                    {savingAgent ? '保存中…' : '保存配置'}
                                </Button>
                            </Box>

                            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                                当前：{agentConfig?.provider || agentProvider} • Key：{agentConfig?.has_api_key ? '已配置' : '未配置'}
                            </Typography>
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
