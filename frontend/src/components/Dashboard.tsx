import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import Box from '@mui/material/Box';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import { TopBar } from './TopBar';
import { ContactGrid } from './ContactGrid';
import { ConversationDrawer } from './ConversationDrawer';
import { AgentChatPanel } from './AgentChatPanel';
import { GuideCards } from './GuideCards';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Contact, ConnectedAccount, createAccount, listAccounts, startAccountOAuth, syncAccount } from '../api';
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
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'warning' } | null>(null);
  const [gmailPromptOpen, setGmailPromptOpen] = useState(false);
  const [bindingGmail, setBindingGmail] = useState(false);

  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const contactsKey = useMemo(() => {
    const qs = new URLSearchParams();
    if (debouncedQuery) qs.set('q', debouncedQuery);
    qs.set('limit', '200');
    return `/api/v1/contacts?${qs.toString()}`;
  }, [debouncedQuery]);

  const { data: contacts, mutate: mutateContacts } = useSWR<Contact[]>(contactsKey);
  const { data: accounts, mutate: mutateAccounts } = useSWR<ConnectedAccount[]>('/api/v1/accounts');
  const hasGmailAccount = useMemo(
    () => !!accounts?.some((item) => item.provider.toLowerCase() === 'gmail'),
    [accounts]
  );

  React.useEffect(() => {
    if (!accounts) return;
    if (hasGmailAccount) {
      setGmailPromptOpen(false);
      sessionStorage.removeItem('mercurydesk:gmail-bind-dismissed');
      return;
    }
    const dismissed = sessionStorage.getItem('mercurydesk:gmail-bind-dismissed') === '1';
    if (!dismissed) setGmailPromptOpen(true);
  }, [accounts, hasGmailAccount]);

  const syncSingleAccount = async (accountId: number, label: string) => {
    try {
      const res = await syncAccount(accountId);
      setToast({ message: `${label}已连接并同步：+${res.inserted}`, severity: 'success' });
    } catch (error) {
      setToast({
        message: error instanceof Error
          ? `${label}已连接，但首次同步失败（${error.message}）。可稍后在设置中手动同步。`
          : `${label}已连接，但首次同步失败。可稍后在设置中手动同步。`,
        severity: 'warning',
      });
    }
  };

  const showGmailOAuthSetupGuide = (popup: Window, message: string): boolean => {
    if (!message.includes('未配置 client_id/client_secret')) return false;
    popup.document.title = 'Gmail OAuth 未配置';
    popup.document.body.innerHTML = `
      <div style="font-family:system-ui;padding:20px;line-height:1.65">
        <h3 style="margin:0 0 8px">未完成 Gmail OAuth 配置</h3>
        <p style="margin:0 0 12px">${message}</p>
        <ol style="margin:0 0 12px;padding-left:20px">
          <li>在后端配置：<code>MERCURYDESK_GMAIL_CLIENT_ID</code> 与 <code>MERCURYDESK_GMAIL_CLIENT_SECRET</code></li>
          <li>Google 回调地址：<code>http://127.0.0.1:8000/api/v1/accounts/oauth/gmail/callback</code></li>
          <li>重启后端后再次点击“同意并绑定 Gmail”</li>
        </ol>
        <p style="margin:0;color:#6b7280">建议在 <code>backend</code> 目录启动后端，确保读取到环境变量。</p>
      </div>
    `;
    return true;
  };

  const connectGmailFromPrompt = async () => {
    if (bindingGmail) return;
    setBindingGmail(true);
    const knownIds = new Set(
      (accounts ?? [])
        .filter((item) => item.provider.toLowerCase() === 'gmail')
        .map((item) => item.id)
    );
    let allowFallback = false;
    let popup: Window | null = null;
    try {
      popup = window.open(
        'about:blank',
        'oauth-gmail-login-bind',
        'width=560,height=760,menubar=no,toolbar=no,status=no'
      );
      if (!popup) throw new Error('浏览器拦截了授权弹窗，请允许弹窗后重试');
      popup.document.title = 'MercuryDesk Gmail OAuth';
      popup.document.body.innerHTML = '<p style="font-family:system-ui;padding:24px;">正在跳转到 Google 授权页面…</p>';

      const started = await startAccountOAuth('gmail');
      popup.location.href = started.auth_url;
      allowFallback = true;

      const result = await new Promise<{ ok: boolean; account_id?: number; error?: string }>((resolve, reject) => {
        let onMessage: (event: MessageEvent) => void;
        let settled = false;
        const finish = (
          fn: (value: { ok: boolean; account_id?: number; error?: string } | Error) => void,
          value: { ok: boolean; account_id?: number; error?: string } | Error
        ) => {
          if (settled) return;
          settled = true;
          window.clearInterval(watcher);
          window.clearTimeout(timeout);
          window.removeEventListener('message', onMessage);
          fn(value);
        };
        const timeout = window.setTimeout(() => finish(reject, new Error('授权超时，请重试')), 180000);
        const watcher = window.setInterval(() => {
          if (popup.closed) {
            window.setTimeout(() => {
              if (!settled) finish(reject, new Error('授权窗口已关闭'));
            }, 450);
          }
        }, 500);
        onMessage = (event: MessageEvent) => {
          const data = event.data as { source?: string; ok?: boolean; account_id?: number; error?: string };
          if (data?.source !== 'mercurydesk-oauth') return;
          finish(resolve, { ok: !!data.ok, account_id: data.account_id, error: data.error });
        };
        window.addEventListener('message', onMessage);
      });

      if (!result.ok || !result.account_id) {
        throw new Error(result.error || 'Gmail 授权失败');
      }
      await syncSingleAccount(result.account_id, 'Gmail');
      setGmailPromptOpen(false);
      sessionStorage.removeItem('mercurydesk:gmail-bind-dismissed');
      await Promise.all([mutateAccounts(), mutateContacts()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (popup && !popup.closed && !showGmailOAuthSetupGuide(popup, message)) popup.close();
      if (allowFallback) {
        const latest = await listAccounts().catch(() => accounts ?? []);
        const fallback = latest
          .filter((item) => item.provider.toLowerCase() === 'gmail' && !knownIds.has(item.id))
          .sort((a, b) => b.id - a.id)[0];
        if (fallback) {
          await syncSingleAccount(fallback.id, 'Gmail');
          setGmailPromptOpen(false);
          sessionStorage.removeItem('mercurydesk:gmail-bind-dismissed');
          await Promise.all([mutateAccounts(), mutateContacts()]);
          return;
        }
      }
      setToast({
        message: `Gmail 绑定失败：${message}`,
        severity: 'error',
      });
    } finally {
      setBindingGmail(false);
    }
  };

  const deferGmailBinding = () => {
    sessionStorage.setItem('mercurydesk:gmail-bind-dismissed', '1');
    setGmailPromptOpen(false);
  };

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
            borderRadius: 0,
            bgcolor: 'background.paper',
            minHeight: '70vh',
            border: '3px solid',
            borderColor: 'text.primary',
            overflow: 'hidden',
            boxShadow: '8px 8px 0 0 rgba(0,0,0,1)',
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

      <AgentChatPanel currentContact={selectedContact} />

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

      <Dialog open={gmailPromptOpen} onClose={deferGmailBinding} maxWidth="xs" fullWidth>
        <DialogTitle>绑定 Gmail（推荐）</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary">
            当前账号尚未授权 Gmail 读取权限。绑定后可自动同步邮件并集中展示在 MercuryDesk。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={deferGmailBinding} color="inherit">
            稍后再说
          </Button>
          <Button onClick={connectGmailFromPrompt} variant="contained" disabled={bindingGmail}>
            {bindingGmail ? '授权中…' : '同意并绑定 Gmail'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
