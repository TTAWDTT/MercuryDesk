import React, { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import useSWR from 'swr';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

import {
  AgentConfig,
  ModelCatalogResponse,
  User,
  getAgentCatalog,
  testAgent,
  updateAgentConfig,
  uploadAvatar,
} from '../api';
import { useColorMode } from '../theme';
import { TopBar } from './TopBar';
import { useToast } from '../contexts/ToastContext';
import { AccountsSection } from './settings/sections/AccountsSection';
import { AgentSection } from './settings/sections/AgentSection';
import { AppearanceSection } from './settings/sections/AppearanceSection';
import { ProfileSection } from './settings/sections/ProfileSection';

type SettingsSectionKey = 'profile' | 'appearance' | 'accounts' | 'agent';

export default function Settings() {
  const navigate = useNavigate();
  const { mode, toggleColorMode } = useColorMode();
  const { showToast } = useToast();

  const { data: user, mutate: mutateUser } = useSWR<User>('/api/v1/auth/me');
  const { data: agentConfig, mutate: mutateAgentConfig } = useSWR<AgentConfig>('/api/v1/agent/config');
  const { data: modelCatalog, mutate: mutateModelCatalog } = useSWR<ModelCatalogResponse>(
    'agent-catalog',
    () => getAgentCatalog(false)
  );

  const [refreshingCatalog, setRefreshingCatalog] = useState(false);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const [agentProvider, setAgentProvider] = useState('rule_based');
  const [agentBaseUrl, setAgentBaseUrl] = useState('https://api.openai.com/v1');
  const [agentModel, setAgentModel] = useState('gpt-4o-mini');
  const [agentTemperature, setAgentTemperature] = useState(0.2);
  const [agentApiKey, setAgentApiKey] = useState('');
  const [savingAgent, setSavingAgent] = useState(false);
  const [testingAgent, setTestingAgent] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSectionKey>('profile');

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
      showToast('头像已上传', 'success');
      mutateUser(updated, { revalidate: false });
      setAvatarFile(null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : '头像上传失败', 'error');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleRefreshCatalog = async () => {
    setRefreshingCatalog(true);
    try {
      const fresh = await getAgentCatalog(true);
      mutateModelCatalog(fresh, { revalidate: false });
      showToast(`模型目录已刷新（${fresh.providers.length} 个服务商）`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '刷新失败', 'error');
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
      showToast('AI 助手配置已保存', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '保存失败', 'error');
    } finally {
      setSavingAgent(false);
    }
  };

  const handleTestAgent = async () => {
    setTestingAgent(true);
    try {
      const res = await testAgent();
      showToast(`测试通过：${res.message || 'OK'}`, 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : '测试失败', 'error');
    } finally {
      setTestingAgent(false);
    }
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      sx={{ minHeight: '100vh', bgcolor: 'transparent' }}
    >
      <TopBar onRefresh={() => {}} onSearch={() => {}} loading={false} hideSearch hideSync />

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box mb={4} display="flex" alignItems="center">
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" fontWeight="bold">
            设置
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 1fr)' },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Paper sx={{ p: 1.2, position: { md: 'sticky' }, top: { md: 86 } }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 1.5, py: 1 }}>
              设置分类
            </Typography>
            <List dense sx={{ p: 0 }}>
              <ListItemButton selected={activeSection === 'profile'} onClick={() => setActiveSection('profile')}>
                <ListItemText primary="个人资料" secondary="头像与账号信息" />
              </ListItemButton>
              <ListItemButton selected={activeSection === 'appearance'} onClick={() => setActiveSection('appearance')}>
                <ListItemText primary="外观主题" secondary="浅色 / 深色" />
              </ListItemButton>
              <ListItemButton selected={activeSection === 'accounts'} onClick={() => setActiveSection('accounts')}>
                <ListItemText primary="账号连接" secondary="邮箱与社媒来源" />
              </ListItemButton>
              <ListItemButton selected={activeSection === 'agent'} onClick={() => setActiveSection('agent')}>
                <ListItemText primary="AI 助手" secondary="模型与 API 配置" />
              </ListItemButton>
            </List>
          </Paper>

          <Grid container spacing={3}>
            {activeSection === 'profile' && (
              <ProfileSection
                user={user}
                avatarFile={avatarFile}
                avatarPreview={avatarPreview}
                updatingProfile={updatingProfile}
                onAvatarFileChange={setAvatarFile}
                onUploadAvatar={handleUploadAvatar}
              />
            )}

            {activeSection === 'appearance' && (
              <AppearanceSection mode={mode} onToggleMode={toggleColorMode} />
            )}

            {activeSection === 'accounts' && <AccountsSection />}

            {activeSection === 'agent' && (
              <AgentSection
                modelCatalog={modelCatalog}
                selectedModelProvider={selectedModelProvider}
                agentConfig={agentConfig}
                agentProvider={agentProvider}
                agentBaseUrl={agentBaseUrl}
                agentModel={agentModel}
                agentTemperature={agentTemperature}
                agentApiKey={agentApiKey}
                refreshingCatalog={refreshingCatalog}
                savingAgent={savingAgent}
                testingAgent={testingAgent}
                onRefreshCatalog={handleRefreshCatalog}
                onProviderChange={(provider) => {
                  setAgentProvider(provider);
                  setAgentBaseUrl(getDefaultBaseUrlForProvider(provider));
                }}
                onModelChange={setAgentModel}
                onBaseUrlChange={setAgentBaseUrl}
                onTemperatureChange={setAgentTemperature}
                onApiKeyChange={setAgentApiKey}
                onTestAgent={handleTestAgent}
                onSaveAgent={handleSaveAgent}
              />
            )}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
}
