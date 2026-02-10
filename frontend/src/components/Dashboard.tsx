import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import { TopBar } from './TopBar';
import { ContactGrid } from './ContactGrid';
import { ConversationDrawer } from './ConversationDrawer';
import { AgentChatPanel } from './AgentChatPanel';
import { GuideCards } from './GuideCards';
import { GmailBindDialog } from './dashboard/GmailBindDialog';
import { DashboardSyncProgress, SyncProgressPanel } from './dashboard/SyncProgressPanel';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Contact, ConnectedAccount, createAccount, listAccounts, startAccountOAuth, syncAccount } from '../api';
import { useToast } from '../contexts/ToastContext';
import { extractRedirectOriginFromAuthUrl, openOAuthPopup, waitForOAuthPopupMessage } from '../utils/oauthPopup';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { boardLight, boardDark } from '../theme';

export default function Dashboard() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<DashboardSyncProgress | null>(null);
  const [gmailPromptOpen, setGmailPromptOpen] = useState(false);
  const [bindingGmail, setBindingGmail] = useState(false);

  // Keep drawer contact for close animation
  useEffect(() => {
    if (selectedContact) setDrawerContact(selectedContact);
  }, [selectedContact]);

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
      showToast(`${label}已连接并同步：+${res.inserted}`, 'success');
    } catch (error) {
      showToast(
        error instanceof Error
          ? `${label}已连接，但首次同步失败（${error.message}）。可稍后在设置中手动同步。`
          : `${label}已连接，但首次同步失败。可稍后在设置中手动同步。`,
        'warning'
      );
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
      popup = openOAuthPopup('oauth-gmail-login-bind', '正在跳转到 Google 授权页面…');
      const started = await startAccountOAuth('gmail');
      const allowedOrigin = extractRedirectOriginFromAuthUrl(started.auth_url);
      popup.location.href = started.auth_url;
      allowFallback = true;

      const result = await waitForOAuthPopupMessage(popup, { allowedOrigin });

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
      showToast(`Gmail 绑定失败：${message}`, 'error');
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
    setSyncProgress(null);
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

      const total = list.length;
      let current = 0;
      let inserted = 0;
      const failedAccounts: string[] = [];

      for (const account of list) {
        setSyncProgress({
          current,
          total,
          currentAccount: account.identifier || account.provider,
          failedAccounts: [...failedAccounts],
        });
        try {
          const res = await syncAccount(account.id);
          inserted += res.inserted;
        } catch {
          failedAccounts.push(account.identifier || account.provider);
        }
        current++;
        setSyncProgress({
          current,
          total,
          currentAccount: current < total ? (list[current]?.identifier || list[current]?.provider) : '',
          failedAccounts: [...failedAccounts],
        });
      }

      const failed = failedAccounts.length;
      const message =
        failed === 0 ? `同步完成：+${inserted}` : `同步完成：+${inserted}（失败 ${failed} 个：${failedAccounts.join(', ')}）`;
      showToast(message, failed === 0 ? 'success' : 'error');

      await Promise.all([mutateContacts(), mutateAccounts()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '同步失败', 'error');
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  return (
    <Box
        component={motion.div}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.4 }}
        sx={{ minHeight: '100vh', bgcolor: 'transparent', pb: 8 }}
    >
      <TopBar 
        onRefresh={handleSyncAll} 
        onSearch={setSearchQuery} 
        loading={syncing}
      />
      
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper
          elevation={0}
          sx={{
            borderRadius: 0,
            bgcolor: theme.palette.mode === 'light' ? boardLight : boardDark, // 【BOARD】
            backdropFilter: 'blur(4px)',
            minHeight: '70vh',
            border: '3px solid',
            borderColor: 'text.primary',
            overflow: 'hidden',
            boxShadow: `4px 4px 0 0 ${theme.palette.text.primary}`,
          }}
        >
          <Box p={{ xs: 2, md: 2.5 }}>
            <GuideCards
              hasAccounts={!!accounts?.length}
              syncing={syncing}
              onOpenSettings={() => navigate('/settings')}
              onSync={handleSyncAll}
            />
            {syncProgress && <SyncProgressPanel progress={syncProgress} />}
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
        contact={drawerContact}
        onClose={() => {
            setSelectedContact(null);
            mutateContacts();
        }}
      />

      <AgentChatPanel currentContact={selectedContact} />

      <GmailBindDialog
        open={gmailPromptOpen}
        binding={bindingGmail}
        onClose={deferGmailBinding}
        onConfirm={connectGmailFromPrompt}
      />
    </Box>
  );
}
