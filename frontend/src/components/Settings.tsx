import React, { useEffect, useMemo, useState } from 'react';
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
import Link from '@mui/material/Link';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailIcon from '@mui/icons-material/Email';
import SyncIcon from '@mui/icons-material/Sync';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RssFeedIcon from '@mui/icons-material/RssFeed';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import PersonIcon from '@mui/icons-material/Person';
import RefreshIcon from '@mui/icons-material/Refresh';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useColorMode } from '../theme';
import { 
    AgentConfig,
    ConnectedAccount, 
    ForwardAccountInfo,
    ModelCatalogResponse,
    OAuthProviderConfig,
    User, 
    createAccount, 
    deleteAccount, 
    getAgentCatalog,
    getForwardAccountInfo,
    getOAuthProviderConfig,
    listAccounts,
    startAccountOAuth,
    testAgent,
    updateOAuthProviderConfig,
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

type SourceProvider = 'mock' | 'github' | 'gmail' | 'outlook' | 'forward' | 'imap' | 'rss' | 'bilibili' | 'x';
const GMAIL_OAUTH_CONSOLE_URL = 'https://console.cloud.google.com/apis/credentials';
const GMAIL_API_ENABLE_URL = 'https://console.cloud.google.com/apis/library/gmail.googleapis.com';

function accountIcon(provider: string) {
    const normalized = provider.toLowerCase();
    if (normalized === 'github') return <GitHubIcon />;
    if (normalized === 'rss') return <RssFeedIcon />;
    if (normalized === 'bilibili') return <PersonIcon />;
    if (normalized === 'x') return <AlternateEmailIcon />;
    if (normalized === 'forward') return <SyncIcon />;
    return <EmailIcon />;
}

export default function Settings({ onLogout }: SettingsProps) {
    const navigate = useNavigate();
    const { mode, toggleColorMode } = useColorMode();
    const { data: user, mutate: mutateUser } = useSWR<User>('/api/v1/auth/me');
    const { data: accounts, mutate: mutateAccounts } = useSWR<ConnectedAccount[]>('/api/v1/accounts');
    const { data: agentConfig, mutate: mutateAgentConfig } = useSWR<AgentConfig>('/api/v1/agent/config');
    const { data: modelCatalog, mutate: mutateModelCatalog } = useSWR<ModelCatalogResponse>(
        'agent-catalog',
        () => getAgentCatalog(false)
    );

    const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null);
    const [syncing, setSyncing] = useState<number | null>(null);
    const [refreshingCatalog, setRefreshingCatalog] = useState(false);
    
    // Profile State
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [updatingProfile, setUpdatingProfile] = useState(false);

    // Account State
    const [newIdentifier, setNewIdentifier] = useState('');
    const [newProvider, setNewProvider] = useState<SourceProvider>('gmail');
    const [newToken, setNewToken] = useState('');
    const [imapPreset, setImapPreset] = useState<'gmail' | 'outlook' | 'icloud' | 'qq' | '163' | 'custom'>('gmail');
    const [showImapAdvanced, setShowImapAdvanced] = useState(false);
    const [imapHost, setImapHost] = useState('');
    const [imapPort, setImapPort] = useState('993');
    const [imapUseSsl, setImapUseSsl] = useState(true);
    const [imapUsername, setImapUsername] = useState('');
    const [imapPassword, setImapPassword] = useState('');
    const [imapMailbox, setImapMailbox] = useState('INBOX');
    const [rssFeedUrl, setRssFeedUrl] = useState('');
    const [rssHomepageUrl, setRssHomepageUrl] = useState('');
    const [rssDisplayName, setRssDisplayName] = useState('');
    const [bilibiliUid, setBilibiliUid] = useState('');
    const [xUsername, setXUsername] = useState('');
    const [forwardSourceEmail, setForwardSourceEmail] = useState('');
    const [addingAccount, setAddingAccount] = useState(false);
    const [oauthConnecting, setOauthConnecting] = useState<null | 'gmail' | 'outlook'>(null);
    const [oauthClientIdInput, setOauthClientIdInput] = useState('');
    const [oauthClientSecretInput, setOauthClientSecretInput] = useState('');
    const [savingOAuthConfig, setSavingOAuthConfig] = useState(false);
    const [latestForwardInfo, setLatestForwardInfo] = useState<ForwardAccountInfo | null>(null);
    const isOAuthProvider = newProvider === 'gmail' || newProvider === 'outlook';
    const { data: oauthProviderConfig, mutate: mutateOAuthProviderConfig } = useSWR<OAuthProviderConfig>(
        isOAuthProvider ? `oauth-config-${newProvider}` : null,
        () => getOAuthProviderConfig(newProvider as 'gmail' | 'outlook')
    );

    // Agent State
    const [agentProvider, setAgentProvider] = useState('rule_based');
    const [agentBaseUrl, setAgentBaseUrl] = useState('https://api.openai.com/v1');
    const [agentModel, setAgentModel] = useState('gpt-4o-mini');
    const [agentTemperature, setAgentTemperature] = useState(0.2);
    const [agentApiKey, setAgentApiKey] = useState('');
    const [savingAgent, setSavingAgent] = useState(false);
    const [testingAgent, setTestingAgent] = useState(false);

    const selectedModelProvider = useMemo(
        () => modelCatalog?.providers.find((provider) => provider.id === agentProvider) ?? null,
        [modelCatalog, agentProvider]
    );
    const getDefaultBaseUrlForProvider = (providerId: string) => {
        if (providerId === 'rule_based') return 'https://api.openai.com/v1';
        const matched = modelCatalog?.providers.find((provider) => provider.id === providerId);
        return (matched?.api || '').trim() || 'https://api.openai.com/v1';
    };

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
        if (newProvider !== 'forward') {
            setLatestForwardInfo(null);
        }
    }, [newProvider]);

    useEffect(() => {
        if (!isOAuthProvider) {
            setOauthClientIdInput('');
            setOauthClientSecretInput('');
            return;
        }
        setOauthClientSecretInput('');
    }, [isOAuthProvider, newProvider]);

    useEffect(() => {
        if (!agentConfig) return;
        setAgentProvider((agentConfig.provider || 'rule_based').toLowerCase());
        setAgentBaseUrl(agentConfig.base_url || 'https://api.openai.com/v1');
        setAgentModel(agentConfig.model || 'gpt-4o-mini');
        setAgentTemperature(Number.isFinite(agentConfig.temperature) ? agentConfig.temperature : 0.2);
    }, [agentConfig]);

    useEffect(() => {
        if (agentProvider === 'rule_based' || !selectedModelProvider) return;
        if (
            selectedModelProvider.models.length > 0 &&
            !selectedModelProvider.models.some((model) => model.id === agentModel)
        ) {
            setAgentModel(selectedModelProvider.models[0].id);
        }
    }, [agentModel, agentProvider, selectedModelProvider]);

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

    const handleRefreshCatalog = async () => {
        setRefreshingCatalog(true);
        try {
            const fresh = await getAgentCatalog(true);
            mutateModelCatalog(fresh, { revalidate: false });
            setToast({ message: `模型目录已刷新（${fresh.providers.length} 个服务商）`, severity: 'success' });
        } catch (e) {
            setToast({ message: e instanceof Error ? e.message : '刷新失败', severity: 'error' });
        } finally {
            setRefreshingCatalog(false);
        }
    };

    const handleSaveAgent = async () => {
        setSavingAgent(true);
        try {
            const payload: {
                provider: string;
                base_url?: string;
                model?: string;
                temperature: number;
                api_key?: string;
            } = {
                provider: agentProvider,
                temperature: Number.isFinite(agentTemperature) ? agentTemperature : 0.2,
            };
            if (agentProvider !== 'rule_based') {
                payload.base_url = agentBaseUrl.trim();
                payload.model = agentModel.trim();
            }
            if (agentApiKey.trim()) payload.api_key = agentApiKey.trim();

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

    const postConnectSync = async (accountId: number, connectedLabel: string) => {
        try {
            const res = await syncAccount(accountId);
            setToast({ message: `${connectedLabel}已连接并同步：+${res.inserted}`, severity: 'success' });
        } catch (e) {
            setToast({
                message: e instanceof Error
                    ? `${connectedLabel}已连接，首次同步失败（${e.message}）。可稍后手动点“同步”重试。`
                    : `${connectedLabel}已连接，首次同步失败。可稍后手动点“同步”重试。`,
                severity: 'warning',
            });
        }
    };

    const connectAndSync = async (payload: Parameters<typeof createAccount>[0], connectedLabel: string) => {
        const account = await createAccount(payload);
        await postConnectSync(account.id, connectedLabel);
        return account;
    };

    const findNewOAuthAccount = async (
        provider: 'gmail' | 'outlook',
        knownAccountIds: Set<number>
    ): Promise<ConnectedAccount | null> => {
        try {
            const latest = await listAccounts();
            mutateAccounts(latest, { revalidate: false });
            return (
                latest
                    .filter((item) => item.provider.toLowerCase() === provider && !knownAccountIds.has(item.id))
                    .sort((a, b) => b.id - a.id)[0] ?? null
            );
        } catch {
            return null;
        }
    };

    const showOAuthSetupGuide = (popup: Window, provider: 'gmail' | 'outlook', message: string): boolean => {
        if (!message.includes('未配置 client_id/client_secret')) return false;
        const envHint =
            provider === 'gmail'
                ? 'MERCURYDESK_GMAIL_CLIENT_ID / MERCURYDESK_GMAIL_CLIENT_SECRET'
                : 'MERCURYDESK_OUTLOOK_CLIENT_ID / MERCURYDESK_OUTLOOK_CLIENT_SECRET';
        const callbackUrl = `http://127.0.0.1:8000/api/v1/accounts/oauth/${provider}/callback`;
        popup.document.title = 'OAuth 未配置';
        popup.document.body.innerHTML = `
          <div style="font-family:system-ui;padding:20px;line-height:1.65">
            <h3 style="margin:0 0 8px">未完成 ${provider === 'gmail' ? 'Gmail' : 'Outlook'} OAuth 配置</h3>
            <p style="margin:0 0 12px">${message}</p>
            <ol style="margin:0 0 12px;padding-left:20px">
              <li>在后端环境变量设置：<code>${envHint}</code></li>
              <li>OAuth 回调地址填：<code>${callbackUrl}</code></li>
              <li>重启后端后再次点击授权</li>
            </ol>
            <p style="margin:0;color:#6b7280">提示：建议在 <code>backend</code> 目录启动后端。</p>
          </div>
        `;
        return true;
    };

    const connectOAuth = async (provider: 'gmail' | 'outlook') => {
        setOauthConnecting(provider);
        const knownAccountIds = new Set<number>();
        let allowFallback = false;
        let popup: Window | null = null;
        try {
            if (newProvider === provider && oauthClientIdInput.trim() && oauthClientSecretInput.trim()) {
                await saveOAuthConfig(provider, oauthClientIdInput, oauthClientSecretInput, { silent: true });
            }
            popup = window.open(
                'about:blank',
                `oauth-${provider}`,
                'width=560,height=760,menubar=no,toolbar=no,status=no'
            );
            if (!popup) throw new Error('浏览器拦截了授权弹窗，请允许弹窗后重试');
            popup.document.title = 'MercuryDesk OAuth';
            popup.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px;">正在跳转到授权页面…</p>';

            const baselineAccounts = await listAccounts().catch(() => accounts ?? []);
            baselineAccounts
                .filter((item) => item.provider.toLowerCase() === provider)
                .forEach((item) => knownAccountIds.add(item.id));

            const started = await startAccountOAuth(provider);
            popup.location.href = started.auth_url;
            allowFallback = true;

            const result = await new Promise<{ ok: boolean; account_id?: number; identifier?: string; error?: string }>(
                (resolve, reject) => {
                    let onMessage: (event: MessageEvent) => void;
                    let settled = false;
                    const finish = (
                        fn: (value: { ok: boolean; account_id?: number; identifier?: string; error?: string } | Error) => void,
                        value: { ok: boolean; account_id?: number; identifier?: string; error?: string } | Error
                    ) => {
                        if (settled) return;
                        settled = true;
                        window.clearInterval(watcher);
                        window.clearTimeout(timeout);
                        window.removeEventListener('message', onMessage);
                        fn(value);
                    };
                    const timeout = window.setTimeout(() => {
                        finish(reject, new Error('授权超时，请重试'));
                    }, 180000);
                    const watcher = window.setInterval(() => {
                        if (popup.closed) {
                            window.setTimeout(() => {
                                if (!settled) {
                                    finish(reject, new Error('授权窗口已关闭'));
                                }
                            }, 450);
                        }
                    }, 500);

                    onMessage = (event: MessageEvent) => {
                        const data = event.data as {
                            source?: string;
                            ok?: boolean;
                            account_id?: number;
                            identifier?: string;
                            error?: string;
                        };
                        if (data?.source !== 'mercurydesk-oauth') return;
                        finish(resolve, { ok: !!data.ok, account_id: data.account_id, identifier: data.identifier, error: data.error });
                    };
                    window.addEventListener('message', onMessage);
                }
            );

            if (!result.ok || !result.account_id) {
                throw new Error(result.error || '授权失败');
            }
            await postConnectSync(result.account_id, provider === 'gmail' ? 'Gmail' : 'Outlook');
            mutateAccounts();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (popup && !popup.closed && !showOAuthSetupGuide(popup, provider, message)) popup.close();
            if (allowFallback) {
                const fallbackAccount = await findNewOAuthAccount(provider, knownAccountIds);
                if (fallbackAccount) {
                    await postConnectSync(fallbackAccount.id, provider === 'gmail' ? 'Gmail' : 'Outlook');
                    return;
                }
            }
            throw new Error(message);
        } finally {
            setOauthConnecting(null);
        }
    };

    const copyText = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setToast({ message: '已复制到剪贴板', severity: 'success' });
        } catch {
            setToast({ message: '复制失败，请手动复制', severity: 'error' });
        }
    };

    const openExternalPage = (url: string) => {
        window.location.href = url;
    };

    const saveOAuthConfig = async (
        provider: 'gmail' | 'outlook',
        clientId: string,
        clientSecret: string,
        options?: { silent?: boolean }
    ) => {
        const clientIdTrimmed = clientId.trim();
        const clientSecretTrimmed = clientSecret.trim();
        if (!clientIdTrimmed || !clientSecretTrimmed) {
            throw new Error('请填写 client_id 和 client_secret，或导入 OAuth JSON');
        }
        setSavingOAuthConfig(true);
        try {
            const updated = await updateOAuthProviderConfig(provider, {
                client_id: clientIdTrimmed,
                client_secret: clientSecretTrimmed,
            });
            mutateOAuthProviderConfig(updated, { revalidate: false });
            setOauthClientIdInput(clientIdTrimmed);
            setOauthClientSecretInput('');
            if (!options?.silent) {
                setToast({
                    message: `${provider === 'gmail' ? 'Gmail' : 'Outlook'} OAuth 凭据已保存`,
                    severity: 'success',
                });
            }
        } finally {
            setSavingOAuthConfig(false);
        }
    };

    const handleImportOAuthJson = async (
        provider: 'gmail' | 'outlook',
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        try {
            const raw = await file.text();
            const parsed = JSON.parse(raw) as any;
            const candidate = parsed?.web || parsed?.installed || parsed;
            const clientId = String(candidate?.client_id || '').trim();
            const clientSecret = String(candidate?.client_secret || '').trim();
            if (!clientId || !clientSecret) {
                throw new Error('文件中未找到 client_id/client_secret');
            }
            setOauthClientIdInput(clientId);
            setOauthClientSecretInput(clientSecret);
            await saveOAuthConfig(provider, clientId, clientSecret);
        } catch (e) {
            setToast({
                message: e instanceof Error ? `导入失败：${e.message}` : '导入失败',
                severity: 'error',
            });
        }
    };

    const handleAddAccount = async () => {
        setAddingAccount(true);
        try {
            if (newProvider === 'gmail' || newProvider === 'outlook') {
                await connectOAuth(newProvider);
            } else if (newProvider === 'forward') {
                const sourceEmail = forwardSourceEmail.trim().toLowerCase();
                if (!sourceEmail) throw new Error('请填写要接入的邮箱地址');
                if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(sourceEmail)) {
                    throw new Error('请输入有效的邮箱地址');
                }
                const created = await createAccount({
                    provider: 'forward',
                    identifier: sourceEmail,
                    forward_source_email: sourceEmail,
                });
                const info = await getForwardAccountInfo(created.id);
                setLatestForwardInfo(info);
                setToast({ message: '转发地址已生成，请在邮箱里设置自动转发', severity: 'success' });
            } else if (newProvider === 'imap') {
                const email = imapUsername.trim();
                const host = imapHost.trim();
                const mailbox = (imapMailbox || 'INBOX').trim();
                if (!email || !imapPassword) throw new Error('请填写邮箱与授权码/密码');
                if (!host) throw new Error('请先选择邮箱服务商，或在高级设置中填写 IMAP 主机');

                const port = Number(imapPort || 993);
                await connectAndSync(
                    {
                        provider: 'imap',
                        identifier: email,
                        imap_host: host,
                        imap_port: Number.isFinite(port) ? port : 993,
                        imap_use_ssl: imapUseSsl,
                        imap_username: email,
                        imap_password: imapPassword,
                        imap_mailbox: mailbox,
                    },
                    '邮箱'
                );
            } else if (newProvider === 'github') {
                const identifier = newIdentifier.trim() || 'me';
                if (!newToken.trim()) throw new Error('请填写 GitHub Token');
                await connectAndSync(
                    {
                        provider: 'github',
                        identifier,
                        access_token: newToken.trim(),
                    },
                    'GitHub'
                );
            } else if (newProvider === 'rss') {
                const feedUrl = rssFeedUrl.trim();
                if (!feedUrl) throw new Error('请填写 RSS / Atom 订阅链接');
                const displayName = rssDisplayName.trim();
                const homepage = rssHomepageUrl.trim();
                await connectAndSync(
                    {
                        provider: 'rss',
                        identifier: displayName || homepage || feedUrl,
                        feed_url: feedUrl,
                        feed_homepage_url: homepage || undefined,
                        feed_display_name: displayName || undefined,
                    },
                    'RSS/Blog'
                );
            } else if (newProvider === 'bilibili') {
                const uid = bilibiliUid.trim();
                if (!uid) throw new Error('请填写 Bilibili UP 主 UID');
                await connectAndSync(
                    {
                        provider: 'bilibili',
                        identifier: uid,
                        bilibili_uid: uid,
                        feed_display_name: `B站 UP ${uid}`,
                    },
                    'Bilibili'
                );
            } else if (newProvider === 'x') {
                const username = xUsername.trim().replace(/^@/, '');
                if (!username) throw new Error('请填写 X 用户名');
                await connectAndSync(
                    {
                        provider: 'x',
                        identifier: username,
                        x_username: username,
                        feed_display_name: `X @${username}`,
                    },
                    'X'
                );
            } else {
                await connectAndSync(
                    {
                        provider: 'mock',
                        identifier: 'demo',
                        access_token: 'x',
                    },
                    '演示数据'
                );
            }

            mutateAccounts();
            setNewIdentifier('');
            setNewToken('');
            setImapPassword('');
            setForwardSourceEmail('');
            setRssFeedUrl('');
            setRssHomepageUrl('');
            setRssDisplayName('');
            setBilibiliUid('');
            setXUsername('');
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
                                    浅色：浅蓝色系；深色：纯黑底 + 深蓝强调
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
                                管理你的消息来源。推荐先用 Gmail/Outlook 一键授权；也支持转发接入、IMAP 高级接入、GitHub、RSS、Bilibili、X。
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
                                                    {accountIcon(account.provider)}
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
                                <Typography variant="subtitle2" fontWeight="bold" mb={0.5}>连接新来源（简化版）</Typography>
                                <Typography variant="caption" color="textSecondary">
                                    只填必要字段，连接后自动同步一次验证。
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
                                                onChange={(e) => setNewProvider(e.target.value as SourceProvider)}
                                                SelectProps={{ native: true }}
                                            >
                                                <option value="gmail">Gmail（一键授权，推荐）</option>
                                                <option value="outlook">Outlook（一键授权，推荐）</option>
                                                <option value="forward">邮箱转发接入（更简）</option>
                                                <option value="imap">邮箱（IMAP）</option>
                                                <option value="github">GitHub 通知</option>
                                                <option value="rss">RSS / Blog</option>
                                                <option value="bilibili">Bilibili UP 动态</option>
                                                <option value="x">X 用户更新</option>
                                                <option value="mock">演示数据</option>
                                            </TextField>
                                        </Grid>

                                        {(newProvider === 'gmail' || newProvider === 'outlook') && (
                                            <>
                                                <Grid size={{ xs: 12 }}>
                                                    <Alert severity="success" sx={{ borderRadius: 3 }}>
                                                        推荐方式：点击下方按钮，跳转到 {newProvider === 'gmail' ? 'Google' : 'Microsoft'} 官方授权页，一次授权即可读取邮件。
                                                        {oauthProviderConfig?.configured ? '（当前已配置 OAuth 凭据）' : '（首次请先保存 OAuth 凭据，可在此页完成）'}
                                                    </Alert>
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <Alert severity={oauthProviderConfig?.configured ? 'info' : 'warning'} sx={{ borderRadius: 3 }}>
                                                        {oauthProviderConfig?.configured
                                                            ? `已保存 ${newProvider === 'gmail' ? 'Gmail' : 'Outlook'} OAuth 配置：${oauthProviderConfig.client_id_hint || '已隐藏'}`
                                                            : `尚未保存 ${newProvider === 'gmail' ? 'Gmail' : 'Outlook'} OAuth 配置。你可以直接在当前页面保存，无需改 .env。`}
                                                    </Alert>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="OAuth Client ID"
                                                        value={oauthClientIdInput}
                                                        onChange={(e) => setOauthClientIdInput(e.target.value)}
                                                        placeholder={newProvider === 'gmail' ? 'xxx.apps.googleusercontent.com' : '应用 Client ID'}
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="password"
                                                        label="OAuth Client Secret"
                                                        value={oauthClientSecretInput}
                                                        onChange={(e) => setOauthClientSecretInput(e.target.value)}
                                                        placeholder="输入后仅本次显示"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12 }} display="flex" gap={1.2} flexWrap="wrap">
                                                    <Button
                                                        variant="outlined"
                                                        disabled={savingOAuthConfig}
                                                        onClick={() =>
                                                            saveOAuthConfig(
                                                                newProvider as 'gmail' | 'outlook',
                                                                oauthClientIdInput,
                                                                oauthClientSecretInput
                                                            ).catch((e) =>
                                                                setToast({
                                                                    message: e instanceof Error ? e.message : '保存 OAuth 配置失败',
                                                                    severity: 'error',
                                                                })
                                                            )
                                                        }
                                                    >
                                                        {savingOAuthConfig ? '保存中…' : '保存 OAuth 配置'}
                                                    </Button>
                                                    <Button variant="text" component="label" disabled={savingOAuthConfig}>
                                                        导入 OAuth JSON 并保存
                                                        <input
                                                            hidden
                                                            type="file"
                                                            accept="application/json,.json"
                                                            onChange={(e) =>
                                                                handleImportOAuthJson(newProvider as 'gmail' | 'outlook', e)
                                                            }
                                                        />
                                                    </Button>
                                                    {newProvider === 'gmail' && (
                                                        <>
                                                            <Button
                                                                variant="text"
                                                                onClick={() => openExternalPage(GMAIL_OAUTH_CONSOLE_URL)}
                                                                aria-label="在新窗口打开 OAuth 配置页"
                                                            >
                                                                跳转查看信息（OAuth 配置页，新窗口）
                                                            </Button>
                                                            <Button
                                                                variant="text"
                                                                onClick={() => openExternalPage(GMAIL_API_ENABLE_URL)}
                                                                aria-label="在新窗口打开 Gmail API 启用页面"
                                                            >
                                                                跳转启用 Gmail API（新窗口）
                                                            </Button>
                                                        </>
                                                    )}
                                                </Grid>
                                            </>
                                        )}

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

                                        {newProvider === 'forward' && (
                                            <>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="要接入的邮箱地址"
                                                        value={forwardSourceEmail}
                                                        onChange={(e) => setForwardSourceEmail(e.target.value)}
                                                        placeholder="you@example.com"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <Alert severity="info" sx={{ borderRadius: 3 }}>
                                                        创建后会生成一个专属转发地址。去你的邮箱设置里添加“自动转发到该地址”即可接入，无需再配置 Webhook。
                                                    </Alert>
                                                </Grid>
                                                {latestForwardInfo && (
                                                    <Grid size={{ xs: 12 }}>
                                                        <Alert severity="success" sx={{ borderRadius: 3 }}>
                                                            <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} flexWrap="wrap">
                                                                <Typography variant="body2">
                                                                    专属转发地址：{latestForwardInfo.forward_address}
                                                                </Typography>
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    onClick={() => copyText(latestForwardInfo.forward_address)}
                                                                >
                                                                    复制地址
                                                                </Button>
                                                            </Box>
                                                            <Typography variant="caption" display="block" sx={{ mt: 0.8 }}>
                                                                已绑定邮箱：{latestForwardInfo.source_email}。完成邮箱端自动转发后，新邮件会自动进入 MercuryDesk。
                                                            </Typography>
                                                        </Alert>
                                                    </Grid>
                                                )}
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
                                                        高级接入（兜底方案）：三步完成 ① 开启 IMAP ② 生成授权码 ③ 填写邮箱+授权码。优先推荐 Gmail/Outlook 一键授权。
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

                                        {newProvider === 'rss' && (
                                            <>
                                                <Grid size={{ xs: 12, sm: 8 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="RSS / Atom 地址"
                                                        value={rssFeedUrl}
                                                        onChange={(e) => setRssFeedUrl(e.target.value)}
                                                        placeholder="https://example.com/feed.xml"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 4 }}>
                                                    <Button
                                                        fullWidth
                                                        variant="outlined"
                                                        onClick={() => {
                                                            setRssFeedUrl('https://claude.com/blog/');
                                                            setRssHomepageUrl('https://claude.com/blog/');
                                                            setRssDisplayName('Claude Blog');
                                                        }}
                                                    >
                                                        一键填入 Claude Blog
                                                    </Button>
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="显示名称（可选）"
                                                        value={rssDisplayName}
                                                        onChange={(e) => setRssDisplayName(e.target.value)}
                                                        placeholder="例如：Claude Blog"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="主页链接（可选）"
                                                        value={rssHomepageUrl}
                                                        onChange={(e) => setRssHomepageUrl(e.target.value)}
                                                        placeholder="https://example.com"
                                                    />
                                                </Grid>
                                            </>
                                        )}

                                        {newProvider === 'bilibili' && (
                                            <>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="UP 主 UID"
                                                        value={bilibiliUid}
                                                        onChange={(e) => setBilibiliUid(e.target.value)}
                                                        placeholder="如：546195"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <Alert severity="info" sx={{ borderRadius: 3 }}>
                                                        使用 RSSHub 订阅 B 站动态，只需 UID，系统会自动生成抓取地址。
                                                    </Alert>
                                                </Grid>
                                            </>
                                        )}

                                        {newProvider === 'x' && (
                                            <>
                                                <Grid size={{ xs: 12, sm: 6 }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="X 用户名"
                                                        value={xUsername}
                                                        onChange={(e) => setXUsername(e.target.value)}
                                                        placeholder="@openai 或 openai"
                                                    />
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <Alert severity="info" sx={{ borderRadius: 3 }}>
                                                        使用 RSSHub 订阅 X 更新，只需用户名，系统会自动生成抓取地址。
                                                    </Alert>
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
                                                disabled={addingAccount || oauthConnecting !== null || savingOAuthConfig}
                                            >
                                                {addingAccount
                                                    ? '连接中…'
                                                    : oauthConnecting
                                                        ? '授权中…'
                                                        : (newProvider === 'gmail' || newProvider === 'outlook')
                                                            ? '开始授权连接'
                                                            : newProvider === 'forward'
                                                                ? '生成转发地址'
                                                                : '连接并同步'}
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
                            <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
                                <Box>
                                    <Typography variant="h6" gutterBottom>AI 助手 / Agent</Typography>
                                    <Typography variant="body2" color="textSecondary">
                                        模型列表自动来自 models.dev，可直接选择服务商与模型。
                                    </Typography>
                                </Box>
                                <Button
                                    variant="outlined"
                                    startIcon={refreshingCatalog ? <CircularProgress size={16} /> : <RefreshIcon />}
                                    onClick={handleRefreshCatalog}
                                    disabled={refreshingCatalog}
                                >
                                    刷新模型目录
                                </Button>
                            </Box>

                            <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <TextField
                                        select
                                        fullWidth
                                        size="small"
                                        label="服务商"
                                        value={agentProvider}
                                        onChange={(e) => {
                                            const nextProvider = e.target.value;
                                            setAgentProvider(nextProvider);
                                            setAgentBaseUrl(getDefaultBaseUrlForProvider(nextProvider));
                                        }}
                                        SelectProps={{ native: true }}
                                    >
                                        <option value="rule_based">内置规则（免费）</option>
                                        {(modelCatalog?.providers ?? []).map((provider) => (
                                            <option key={provider.id} value={provider.id}>
                                                {provider.name} ({provider.id})
                                            </option>
                                        ))}
                                    </TextField>
                                </Grid>

                                {agentProvider !== 'rule_based' && (
                                    <>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            {selectedModelProvider?.models?.length ? (
                                                <TextField
                                                    select
                                                    fullWidth
                                                    size="small"
                                                    label="模型"
                                                    value={agentModel}
                                                    onChange={(e) => setAgentModel(e.target.value)}
                                                    SelectProps={{ native: true }}
                                                >
                                                    {selectedModelProvider.models.map((model) => (
                                                        <option key={model.id} value={model.id}>
                                                            {model.name} ({model.id})
                                                        </option>
                                                    ))}
                                                </TextField>
                                            ) : (
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="模型"
                                                    value={agentModel}
                                                    onChange={(e) => setAgentModel(e.target.value)}
                                                    placeholder="输入模型 ID"
                                                />
                                            )}
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="接口地址（Base URL）"
                                                value={agentBaseUrl}
                                                onChange={(e) => setAgentBaseUrl(e.target.value)}
                                                placeholder={selectedModelProvider?.api ?? 'https://api.openai.com/v1'}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 4 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                type="number"
                                                label="随机度（Temperature）"
                                                value={agentTemperature}
                                                onChange={(e) => {
                                                    const value = Number(e.target.value);
                                                    setAgentTemperature(Number.isFinite(value) ? value : 0.2);
                                                }}
                                                inputProps={{ min: 0, max: 2, step: 0.1 }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 8 }}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                type="password"
                                                label="API Key（留空则沿用已保存 Key）"
                                                value={agentApiKey}
                                                onChange={(e) => setAgentApiKey(e.target.value)}
                                                placeholder={agentConfig?.has_api_key ? '已保存（不显示）' : 'sk-...'}
                                                helperText={
                                                    selectedModelProvider?.env?.length
                                                        ? `常用环境变量：${selectedModelProvider.env.join(', ')}`
                                                        : '建议在后端设置 MERCURYDESK_FERNET_KEY 以加密保存。'
                                                }
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Alert severity="warning" sx={{ borderRadius: 3 }}>
                                                当前通过 OpenAI-Compatible 接口调用模型。请确保 Base URL 与模型 ID 对应同一服务商。
                                                {selectedModelProvider?.doc && (
                                                    <>
                                                        {' '}文档：
                                                        <Link href={selectedModelProvider.doc} target="_blank" rel="noopener noreferrer">
                                                            {selectedModelProvider.doc}
                                                        </Link>
                                                    </>
                                                )}
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
                    autoHideDuration={4500} 
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
