
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import useSWR from 'swr';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import { TopBar } from './TopBar';
import { ContactGrid } from './ContactGrid';
import { ConversationDrawer } from './ConversationDrawer';
import { AgentChatPanel } from './AgentChatPanel';
import { GmailBindDialog } from './dashboard/GmailBindDialog';
import { FirstRunGuideDialog } from './dashboard/FirstRunGuideDialog';
import { DashboardSyncProgress, SyncProgressPanel } from './dashboard/SyncProgressPanel';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import {
  AgentAdvancedSearchItem,
  AgentCardLayoutItem,
  AgentDailyBrief,
  AgentDailyBriefAction,
  AgentMemorySnapshot,
  AgentPinRecommendationResponse,
  AgentTodoItem,
  Contact,
  ConnectedAccount,
  addAgentMemoryNote,
  advancedSearch,
  agentDraftReply,
  agentSummarize,
  createAccount,
  createAgentTodo,
  deleteAgentMemoryNote,
  deleteAgentTodo,
  getAgentMemory,
  listAccounts,
  startAccountOAuth,
  syncAccount,
  syncAgentCardLayout,
  updateAgentTodo,
} from '../api';
import { useToast } from '../contexts/ToastContext';
import { extractRedirectOriginFromAuthUrl, openOAuthPopup, waitForOAuthPopupMessage } from '../utils/oauthPopup';
import { boardLight, boardDark } from '../theme';

const DEFAULT_DASHBOARD_SYNC_CONCURRENCY = 12;
const DASHBOARD_SYNC_CONCURRENCY = (() => {
  const raw = Number(
    import.meta.env.VITE_DASHBOARD_SYNC_CONCURRENCY ??
      DEFAULT_DASHBOARD_SYNC_CONCURRENCY
  );
  if (!Number.isFinite(raw)) return DEFAULT_DASHBOARD_SYNC_CONCURRENCY;
  return Math.max(1, Math.floor(raw));
})();

const FIRST_RUN_GUIDE_KEY = 'mercurydesk:dashboard:first-run-guide:v1';
const WORKSPACE_KEY = 'mercurydesk:dashboard:workspace:v1';
const WORKSPACES = [
  { key: 'default', label: '主工作区' },
  { key: 'work', label: '工作' },
  { key: 'life', label: '生活' },
  { key: 'monitor', label: '监控' },
];

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const formatRunningAccounts = (labels: string[]) => {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return labels.join('、');
  return `${labels[0]}、${labels[1]} 等 ${labels.length} 个账户`;
};

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
  const [firstRunGuideOpen, setFirstRunGuideOpen] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState<string>(() => {
    try {
      return localStorage.getItem(WORKSPACE_KEY) || 'default';
    } catch {
      return 'default';
    }
  });

  const [memorySnapshot, setMemorySnapshot] = useState<AgentMemorySnapshot | null>(null);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [memoryCorrection, setMemoryCorrection] = useState('');

  const [todoInput, setTodoInput] = useState('');
  const [todoBusy, setTodoBusy] = useState(false);

  const [quickActionOutput, setQuickActionOutput] = useState<{ title: string; content: string } | null>(null);
  const [advancedQuery, setAdvancedQuery] = useState('');
  const [advancedSource, setAdvancedSource] = useState('');
  const [advancedUnreadOnly, setAdvancedUnreadOnly] = useState(false);
  const [advancedDays, setAdvancedDays] = useState(30);
  const [advancedLimit, setAdvancedLimit] = useState(20);
  const [advancedBusy, setAdvancedBusy] = useState(false);
  const [advancedItems, setAdvancedItems] = useState<AgentAdvancedSearchItem[]>([]);
  const [actionBusy, setActionBusy] = useState(false);

  const layoutSyncTimerRef = useRef<number | null>(null);

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
  const { data: pinRecommendations, mutate: mutatePinRecommendations } = useSWR<AgentPinRecommendationResponse>('/api/v1/agent/pin-recommendations?limit=8');
  const { data: dailyBrief, mutate: mutateDailyBrief } = useSWR<AgentDailyBrief>('/api/v1/agent/daily-brief');
  const { data: todos, mutate: mutateTodos } = useSWR<AgentTodoItem[]>('/api/v1/agent/todos?include_done=false');

  const contactsById = useMemo(() => {
    const map = new Map<number, Contact>();
    (contacts ?? []).forEach((item) => map.set(item.id, item));
    return map;
  }, [contacts]);

  const hasGmailAccount = useMemo(
    () => !!accounts?.some((item) => item.provider.toLowerCase() === 'gmail'),
    [accounts]
  );

  const loadMemorySnapshot = useCallback(async (query = '') => {
    setMemoryBusy(true);
    try {
      const data = await getAgentMemory(query);
      setMemorySnapshot(data);
    } catch (error) {
      showToast(error instanceof Error ? `记忆加载失败: ${error.message}` : '记忆加载失败', 'error');
    } finally {
      setMemoryBusy(false);
    }
  }, [showToast]);

  const refreshAgentPanels = useCallback(async () => {
    await Promise.all([
      mutatePinRecommendations(),
      mutateDailyBrief(),
      mutateTodos(),
      loadMemorySnapshot(''),
    ]);
  }, [loadMemorySnapshot, mutateDailyBrief, mutatePinRecommendations, mutateTodos]);

  useEffect(() => {
    if (!accounts) return;
    if (hasGmailAccount) {
      setGmailPromptOpen(false);
      sessionStorage.removeItem('mercurydesk:gmail-bind-dismissed');
      return;
    }
    const dismissed = sessionStorage.getItem('mercurydesk:gmail-bind-dismissed') === '1';
    if (!dismissed) setGmailPromptOpen(true);
  }, [accounts, hasGmailAccount]);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(FIRST_RUN_GUIDE_KEY) === '1';
      if (!seen) setFirstRunGuideOpen(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_KEY, activeWorkspace);
    } catch {
      // ignore
    }
  }, [activeWorkspace]);

  useEffect(() => {
    loadMemorySnapshot('');
  }, [loadMemorySnapshot]);

  useEffect(() => {
    return () => {
      if (layoutSyncTimerRef.current !== null) {
        window.clearTimeout(layoutSyncTimerRef.current);
      }
    };
  }, []);

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
      await Promise.all([mutateAccounts(), mutateContacts(), refreshAgentPanels()]);
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
          await Promise.all([mutateAccounts(), mutateContacts(), refreshAgentPanels()]);
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

  const handleCloseFirstRunGuide = useCallback(() => {
    try {
      localStorage.setItem(FIRST_RUN_GUIDE_KEY, '1');
    } catch {
      // ignore
    }
    setFirstRunGuideOpen(false);
  }, []);

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
      let completed = 0;
      let nextIndex = 0;
      let inserted = 0;
      const failedAccounts: string[] = [];
      const runningById = new Map<number, string>();
      const maxRetry = 2;

      const updateProgress = () => {
        const runningLabels = Array.from(runningById.values());
        const runningSummary = formatRunningAccounts(runningLabels);
        setSyncProgress({
          current: completed,
          total,
          currentAccount: runningSummary ? `并发同步中：${runningSummary}` : '完成中...',
          failedAccounts: [...failedAccounts],
        });
      };

      updateProgress();

      const runSyncWorker = async () => {
        while (true) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= total) return;

          const account = list[index];
          const label = account.identifier || account.provider;
          runningById.set(account.id, label);
          updateProgress();

          let success = false;
          let accountInserted = 0;
          try {
            for (let attempt = 0; attempt <= maxRetry; attempt += 1) {
              try {
                if (attempt > 0) {
                  runningById.set(account.id, `${label}（重试 ${attempt}/${maxRetry}）`);
                  updateProgress();
                }
                const res = await syncAccount(account.id);
                accountInserted = res.inserted;
                success = true;
                break;
              } catch (error) {
                if (attempt >= maxRetry) throw error;
                await wait(800 * (attempt + 1));
              }
            }
          } catch {
            failedAccounts.push(label);
          } finally {
            if (success) inserted += accountInserted;
            runningById.delete(account.id);
            completed += 1;
            updateProgress();
          }
        }
      };

      const workerCount = Math.min(DASHBOARD_SYNC_CONCURRENCY, total);
      await Promise.all(Array.from({ length: workerCount }, () => runSyncWorker()));

      const failed = failedAccounts.length;
      const message =
        failed === 0
          ? `同步完成：+${inserted}`
          : `同步完成：+${inserted}（失败 ${failed} 个：${failedAccounts.join(', ')}）`;
      showToast(message, failed === 0 ? 'success' : 'error');

      await Promise.all([mutateContacts(), mutateAccounts(), refreshAgentPanels()]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '同步失败', 'error');
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleCardLayoutChange = useCallback((cards: AgentCardLayoutItem[]) => {
    if (layoutSyncTimerRef.current !== null) {
      window.clearTimeout(layoutSyncTimerRef.current);
    }
    layoutSyncTimerRef.current = window.setTimeout(async () => {
      try {
        await syncAgentCardLayout(cards, activeWorkspace);
      } catch (error) {
        console.error('syncAgentCardLayout failed', error);
      }
    }, 500);
  }, [activeWorkspace]);

  const openContactById = useCallback((contactId?: number | null) => {
    if (!contactId) return;
    const target = contactsById.get(contactId);
    if (!target) {
      showToast('该联系人不在当前筛选结果中，请先清空搜索或刷新。', 'warning');
      return;
    }
    setSelectedContact(target);
  }, [contactsById, showToast]);

  const handleCardAction = useCallback(async (contact: Contact, action: 'summarize' | 'draft' | 'todo') => {
    const text = [
      `联系人: ${contact.display_name}`,
      `渠道: ${contact.latest_source || 'unknown'}`,
      `标题: ${contact.latest_subject || ''}`,
      `内容: ${contact.latest_preview || ''}`,
    ].join('\n');

    try {
      if (action === 'summarize') {
        const res = await agentSummarize(text);
        setQuickActionOutput({
          title: `${contact.display_name} - 快速总结`,
          content: res.summary,
        });
        return;
      }
      if (action === 'draft') {
        const res = await agentDraftReply(text, 'professional');
        setQuickActionOutput({
          title: `${contact.display_name} - 回复草稿`,
          content: res.draft,
        });
        return;
      }
      const todoTitle = `跟进 ${contact.display_name}`;
      await createAgentTodo({
        title: todoTitle,
        detail: `${contact.latest_subject || ''}\n${contact.latest_preview || ''}`.trim(),
        priority: 'high',
        contact_id: contact.id,
      });
      showToast(`已添加待办: ${todoTitle}`, 'success');
      await Promise.all([mutateTodos(), mutateDailyBrief()]);
    } catch (error) {
      showToast(error instanceof Error ? `卡片 AI 动作失败: ${error.message}` : '卡片 AI 动作失败', 'error');
    }
  }, [mutateDailyBrief, mutateTodos, showToast]);

  const handleToggleTodoDone = useCallback(async (todo: AgentTodoItem, done: boolean) => {
    try {
      await updateAgentTodo(todo.id, { done });
      await Promise.all([mutateTodos(), mutateDailyBrief()]);
    } catch (error) {
      showToast(error instanceof Error ? `更新待办失败: ${error.message}` : '更新待办失败', 'error');
    }
  }, [mutateDailyBrief, mutateTodos, showToast]);

  const handleDeleteTodo = useCallback(async (todoId: number) => {
    try {
      await deleteAgentTodo(todoId);
      await Promise.all([mutateTodos(), mutateDailyBrief()]);
    } catch (error) {
      showToast(error instanceof Error ? `删除待办失败: ${error.message}` : '删除待办失败', 'error');
    }
  }, [mutateDailyBrief, mutateTodos, showToast]);

  const handleCreateManualTodo = useCallback(async () => {
    const title = todoInput.trim();
    if (!title) return;
    setTodoBusy(true);
    try {
      await createAgentTodo({ title, priority: 'normal' });
      setTodoInput('');
      await Promise.all([mutateTodos(), mutateDailyBrief()]);
    } catch (error) {
      showToast(error instanceof Error ? `新增待办失败: ${error.message}` : '新增待办失败', 'error');
    } finally {
      setTodoBusy(false);
    }
  }, [mutateDailyBrief, mutateTodos, showToast, todoInput]);

  const runAdvancedSearch = useCallback(async () => {
    setAdvancedBusy(true);
    try {
      const result = await advancedSearch({
        query: advancedQuery,
        source: advancedSource || undefined,
        unread_only: advancedUnreadOnly,
        days: advancedDays,
        limit: advancedLimit,
      });
      setAdvancedItems(result.items);
    } catch (error) {
      showToast(error instanceof Error ? `高级检索失败: ${error.message}` : '高级检索失败', 'error');
    } finally {
      setAdvancedBusy(false);
    }
  }, [advancedDays, advancedLimit, advancedQuery, advancedSource, advancedUnreadOnly, showToast]);

  const handleApplyBriefAction = useCallback(async (action: AgentDailyBriefAction) => {
    if (action.contact_id) {
      openContactById(action.contact_id);
      return;
    }
    setActionBusy(true);
    try {
      await createAgentTodo({
        title: action.title,
        detail: action.detail,
        priority: action.priority || 'normal',
        message_id: action.message_id ?? undefined,
      });
      showToast('行动项已加入待办', 'success');
      await Promise.all([mutateTodos(), mutateDailyBrief()]);
    } catch (error) {
      showToast(error instanceof Error ? `处理行动项失败: ${error.message}` : '处理行动项失败', 'error');
    } finally {
      setActionBusy(false);
    }
  }, [mutateDailyBrief, mutateTodos, openContactById, showToast]);

  const handleSaveMemoryCorrection = useCallback(async () => {
    const clean = memoryCorrection.trim();
    if (!clean) return;
    setMemoryBusy(true);
    try {
      await addAgentMemoryNote(clean, 'preference');
      setMemoryCorrection('');
      await loadMemorySnapshot('');
      showToast('记忆修正已保存', 'success');
    } catch (error) {
      setMemoryBusy(false);
      showToast(error instanceof Error ? `保存记忆失败: ${error.message}` : '保存记忆失败', 'error');
    }
  }, [loadMemorySnapshot, memoryCorrection, showToast]);

  const handleDeleteMemoryNote = useCallback(async (noteId: number) => {
    setMemoryBusy(true);
    try {
      await deleteAgentMemoryNote(noteId);
      await loadMemorySnapshot('');
    } catch (error) {
      setMemoryBusy(false);
      showToast(error instanceof Error ? `删除记忆失败: ${error.message}` : '删除记忆失败', 'error');
    }
  }, [loadMemorySnapshot, showToast]);

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
        <Stack spacing={2.2}>
          <Paper
            elevation={0}
            sx={{
              borderRadius: 0,
              bgcolor: theme.palette.mode === 'light' ? boardLight : boardDark,
              backdropFilter: 'blur(4px)',
              minHeight: '70vh',
              border: '3px solid',
              borderColor: 'text.primary',
              overflow: 'hidden',
              boxShadow: `4px 4px 0 0 ${theme.palette.text.primary}`,
            }}
          >
            <Box
              p={{ xs: 1.6, md: 2.2 }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1.2,
                flexWrap: 'wrap',
              }}
            >
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mr: 0.4 }}>
                  工作区:
                </Typography>
                {WORKSPACES.map((item) => (
                  <Chip
                    key={item.key}
                    size="small"
                    clickable
                    onClick={() => setActiveWorkspace(item.key)}
                    color={item.key === activeWorkspace ? 'primary' : 'default'}
                    variant={item.key === activeWorkspace ? 'filled' : 'outlined'}
                    label={item.label}
                  />
                ))}
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={`同步并发 ${DASHBOARD_SYNC_CONCURRENCY}`} />
                <Button size="small" variant="outlined" onClick={() => refreshAgentPanels()}>
                  刷新 AI 面板
                </Button>
              </Stack>
            </Box>
            <Divider />

            {syncProgress && (
              <>
                <Box p={{ xs: 2, md: 2.5 }}>
                  <SyncProgressPanel progress={syncProgress} />
                </Box>
                <Divider />
              </>
            )}

            <ContactGrid
              contacts={contacts}
              loading={!contacts}
              onContactClick={setSelectedContact}
              onCardLayoutChange={handleCardLayoutChange}
              workspace={activeWorkspace}
              pinRecommendations={pinRecommendations?.items ?? []}
              onCardAction={handleCardAction}
            />
          </Paper>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0,1fr) minmax(0,1fr)' },
              gap: 2,
            }}
          >
            <Stack spacing={2}>
              <Paper sx={{ borderRadius: 0, border: '2px solid', borderColor: 'text.primary', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  每日简报与行动
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                  {dailyBrief?.summary || '正在生成每日简报…'}
                </Typography>
                {!dailyBrief && <LinearProgress sx={{ mt: 1.4 }} />}

                {!!dailyBrief?.top_updates?.length && (
                  <Box sx={{ mt: 1.6, display: 'grid', gap: 1 }}>
                    {dailyBrief.top_updates.slice(0, 4).map((item) => (
                      <Paper
                        key={`${item.message_id}-${item.source}`}
                        variant="outlined"
                        sx={{ borderRadius: 0, p: 1, borderStyle: 'dashed' }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={item.source_label} />
                          <Chip size="small" variant="outlined" label={`分数 ${Math.round(item.score)}`} />
                        </Stack>
                        <Typography variant="body2" sx={{ mt: 0.8, fontWeight: 700 }}>
                          {item.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.sender} · {item.received_at}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                )}

                {!!dailyBrief?.actions?.length && (
                  <Box sx={{ mt: 1.6, display: 'grid', gap: 0.8 }}>
                    {dailyBrief.actions.slice(0, 6).map((action, idx) => (
                      <Box
                        key={`${action.kind}-${action.title}-${idx}`}
                        sx={{
                          border: '1px dashed',
                          borderColor: 'divider',
                          p: 1,
                          borderRadius: 0,
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {action.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {action.detail || '无补充信息'}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={actionBusy}
                          onClick={() => handleApplyBriefAction(action)}
                        >
                          执行
                        </Button>
                      </Box>
                    ))}
                  </Box>
                )}
              </Paper>

              <Paper sx={{ borderRadius: 0, border: '2px solid', borderColor: 'text.primary', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  待办与跟进
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder="新增待办（例如：周五前回复小红书合作）"
                    value={todoInput}
                    onChange={(event) => setTodoInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleCreateManualTodo();
                      }
                    }}
                  />
                  <Button variant="contained" disabled={todoBusy} onClick={handleCreateManualTodo}>
                    添加
                  </Button>
                </Stack>

                <Box sx={{ mt: 1.4, display: 'grid', gap: 0.7 }}>
                  {(todos ?? []).slice(0, 16).map((todo) => (
                    <Paper
                      key={todo.id}
                      variant="outlined"
                      sx={{
                        borderRadius: 0,
                        p: 0.9,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={todo.done}
                        onChange={(event) => handleToggleTodoDone(todo, event.target.checked)}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            textDecoration: todo.done ? 'line-through' : 'none',
                          }}
                        >
                          {todo.title}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {(todo.detail || '无详情').replace(/\s+/g, ' ').trim()}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={todo.priority || 'normal'}
                        color={todo.priority === 'high' ? 'warning' : 'default'}
                      />
                      {todo.contact_id ? (
                        <IconButton size="small" onClick={() => openContactById(todo.contact_id)} title="打开联系人">
                          <OpenInNewIcon fontSize="inherit" />
                        </IconButton>
                      ) : null}
                      <IconButton size="small" onClick={() => handleDeleteTodo(todo.id)} title="删除待办">
                        <DeleteOutlineIcon fontSize="inherit" />
                      </IconButton>
                    </Paper>
                  ))}
                  {!(todos && todos.length) && (
                    <Typography variant="body2" color="text.secondary">
                      目前没有待办项。
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Stack>

            <Stack spacing={2}>
              <Paper sx={{ borderRadius: 0, border: '2px solid', borderColor: 'text.primary', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  高级检索
                </Typography>
                <Stack spacing={1.1} sx={{ mt: 1.2 }}>
                  <TextField
                    size="small"
                    label="查询词"
                    value={advancedQuery}
                    onChange={(event) => setAdvancedQuery(event.target.value)}
                    placeholder="如：合作报价 / campaign / 风险"
                  />
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      select
                      label="来源"
                      value={advancedSource}
                      onChange={(event) => setAdvancedSource(event.target.value)}
                      sx={{ minWidth: 140 }}
                    >
                      <MenuItem value="">全部</MenuItem>
                      <MenuItem value="imap">邮件</MenuItem>
                      <MenuItem value="github">GitHub</MenuItem>
                      <MenuItem value="rss">RSS</MenuItem>
                      <MenuItem value="x">X</MenuItem>
                      <MenuItem value="bilibili">Bilibili</MenuItem>
                      <MenuItem value="douyin">抖音</MenuItem>
                      <MenuItem value="xiaohongshu">小红书</MenuItem>
                    </TextField>
                    <TextField
                      size="small"
                      type="number"
                      label="近几天"
                      inputProps={{ min: 1, max: 365 }}
                      value={advancedDays}
                      onChange={(event) => setAdvancedDays(Math.max(1, Math.min(365, Number(event.target.value) || 30)))}
                    />
                    <TextField
                      size="small"
                      type="number"
                      label="条数"
                      inputProps={{ min: 1, max: 100 }}
                      value={advancedLimit}
                      onChange={(event) => setAdvancedLimit(Math.max(1, Math.min(100, Number(event.target.value) || 20)))}
                    />
                  </Stack>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={advancedUnreadOnly}
                        onChange={(event) => setAdvancedUnreadOnly(event.target.checked)}
                      />
                    }
                    label="仅看未读"
                  />
                  <Button variant="contained" onClick={runAdvancedSearch} disabled={advancedBusy}>
                    {advancedBusy ? '检索中…' : '开始检索'}
                  </Button>
                </Stack>

                <Box sx={{ mt: 1.4, display: 'grid', gap: 0.8 }}>
                  {advancedItems.map((item) => (
                    <Paper
                      key={`${item.message_id}-${item.score}`}
                      variant="outlined"
                      sx={{ borderRadius: 0, p: 1, borderStyle: 'dashed' }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={item.source} />
                        <Chip size="small" variant="outlined" label={`score ${item.score}`} />
                        {!item.is_read && <Chip size="small" color="warning" label="未读" />}
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 700 }}>
                        {item.subject || '(无主题)'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
                        {item.sender} · {item.received_at} · {item.reason}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
                        {item.preview}
                      </Typography>
                      <Button size="small" sx={{ mt: 0.8 }} onClick={() => openContactById(item.contact_id)}>
                        打开联系人
                      </Button>
                    </Paper>
                  ))}
                  {!advancedBusy && advancedItems.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      还没有检索结果。
                    </Typography>
                  )}
                </Box>
              </Paper>

              <Paper sx={{ borderRadius: 0, border: '2px solid', borderColor: 'text.primary', p: 2 }}>
                <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    记忆解释面板
                  </Typography>
                  <Button size="small" variant="outlined" onClick={() => loadMemorySnapshot('')}>
                    刷新
                  </Button>
                </Stack>

                {memoryBusy && <LinearProgress sx={{ mt: 1.2 }} />}
                {!memorySnapshot && !memoryBusy && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.2 }}>
                    记忆尚未生成。
                  </Typography>
                )}

                {!!memorySnapshot && (
                  <>
                    <Typography variant="body2" sx={{ mt: 1.1 }}>
                      {(memorySnapshot.summary || '暂无摘要').trim() || '暂无摘要'}
                    </Typography>

                    <Divider sx={{ my: 1.2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      最近关注的信息/帖子
                    </Typography>
                    <Box sx={{ mt: 0.9, display: 'grid', gap: 0.7 }}>
                      {memorySnapshot.focus_items.slice(0, 6).map((item) => (
                        <Paper
                          key={`${item.message_id}-${item.source}`}
                          variant="outlined"
                          sx={{ borderRadius: 0, p: 0.9, borderStyle: 'dashed' }}
                        >
                          <Typography variant="caption">
                            [{item.source_label}] {item.title}
                          </Typography>
                        </Paper>
                      ))}
                    </Box>

                    <Divider sx={{ my: 1.2 }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      可编辑记忆
                    </Typography>
                    <Box sx={{ mt: 0.9, display: 'grid', gap: 0.7 }}>
                      {memorySnapshot.notes.slice(0, 12).map((note) => (
                        <Paper
                          key={note.id}
                          variant="outlined"
                          sx={{
                            borderRadius: 0,
                            p: 0.8,
                            borderStyle: 'dashed',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                          }}
                        >
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {note.kind}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 0.2 }}>
                              {note.content}
                            </Typography>
                          </Box>
                          <IconButton size="small" onClick={() => handleDeleteMemoryNote(note.id)}>
                            <DeleteOutlineIcon fontSize="inherit" />
                          </IconButton>
                        </Paper>
                      ))}
                    </Box>
                  </>
                )}

                <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={memoryCorrection}
                    onChange={(event) => setMemoryCorrection(event.target.value)}
                    placeholder="补充一条偏好或事实，例如：我最近优先关注抖音商业合作私信"
                  />
                  <Button variant="contained" onClick={handleSaveMemoryCorrection} disabled={memoryBusy}>
                    保存
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          </Box>
        </Stack>
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

      <FirstRunGuideDialog
        open={firstRunGuideOpen}
        hasAccounts={!!accounts?.length}
        syncing={syncing}
        onClose={handleCloseFirstRunGuide}
        onOpenSettings={() => {
          handleCloseFirstRunGuide();
          navigate('/settings');
        }}
        onSync={handleSyncAll}
      />

      <Dialog
        open={!!quickActionOutput}
        fullWidth
        maxWidth="md"
        onClose={() => setQuickActionOutput(null)}
      >
        <DialogTitle>{quickActionOutput?.title || 'AI 输出'}</DialogTitle>
        <DialogContent dividers>
          <Typography component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontFamily: 'inherit' }}>
            {quickActionOutput?.content || ''}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuickActionOutput(null)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
