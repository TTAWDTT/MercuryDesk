import React from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import Link from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import RefreshIcon from "@mui/icons-material/Refresh";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { AgentConfig, ModelCatalogResponse, ModelProviderInfo } from "../../../api";

type AgentSectionProps = {
  modelCatalog?: ModelCatalogResponse;
  selectedModelProvider: ModelProviderInfo | null;
  agentConfig?: AgentConfig;
  agentProvider: string;
  agentBaseUrl: string;
  agentModel: string;
  agentTemperature: number;
  agentApiKey: string;
  refreshingCatalog: boolean;
  savingAgent: boolean;
  testingAgent: boolean;
  onRefreshCatalog: () => void;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  onBaseUrlChange: (baseUrl: string) => void;
  onTemperatureChange: (temperature: number) => void;
  onApiKeyChange: (apiKey: string) => void;
  onTestAgent: () => void;
  onSaveAgent: () => void;
};

export function AgentSection({
  modelCatalog,
  selectedModelProvider,
  agentConfig,
  agentProvider,
  agentBaseUrl,
  agentModel,
  agentTemperature,
  agentApiKey,
  refreshingCatalog,
  savingAgent,
  testingAgent,
  onRefreshCatalog,
  onProviderChange,
  onModelChange,
  onBaseUrlChange,
  onTemperatureChange,
  onApiKeyChange,
  onTestAgent,
  onSaveAgent,
}: AgentSectionProps) {
  return (
    <Grid size={{ xs: 12 }}>
      <Paper sx={{ p: 4 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" gap={2} flexWrap="wrap">
          <Box>
            <Typography variant="h6" gutterBottom>
              AI 助手 / Agent
            </Typography>
            <Typography variant="body2" color="textSecondary">
              模型列表自动来自 models.dev，可直接选择服务商与模型。
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={refreshingCatalog ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={onRefreshCatalog}
            disabled={refreshingCatalog}
          >
            刷新模型目录
          </Button>
        </Box>

        <Box mt={2} mb={2}>
          <Alert severity="info" sx={{ borderRadius: 0 }}>
            ✨ <b>即将推出：MercuryDesk Agent</b> —— 这里的配置将用于驱动未来的智能体功能（自动分类消息、生成回复草稿、每日智能简报等）。目前仅用于简单的摘要测试。
          </Alert>
        </Box>

        <Grid container spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="服务商"
              value={agentProvider}
              onChange={(event) => onProviderChange(event.target.value)}
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

          {agentProvider !== "rule_based" && (
            <>
              <Grid size={{ xs: 12, sm: 4 }}>
                {selectedModelProvider?.models?.length ? (
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="模型"
                    value={agentModel}
                    onChange={(event) => onModelChange(event.target.value)}
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
                    onChange={(event) => onModelChange(event.target.value)}
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
                  onChange={(event) => onBaseUrlChange(event.target.value)}
                  placeholder={selectedModelProvider?.api ?? "https://api.openai.com/v1"}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  label="随机度（Temperature）"
                  value={agentTemperature}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    onTemperatureChange(Number.isFinite(value) ? value : 0.2);
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
                  onChange={(event) => onApiKeyChange(event.target.value)}
                  placeholder={agentConfig?.has_api_key ? "已保存（不显示）" : "sk-..."}
                  helperText={
                    selectedModelProvider?.env?.length
                      ? `常用环境变量：${selectedModelProvider.env.join(", ")}`
                      : "建议在后端设置 MERCURYDESK_FERNET_KEY 以加密保存。"
                  }
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Alert severity="warning" sx={{ borderRadius: 0 }}>
                  当前通过 OpenAI-Compatible 接口调用模型。请确保 Base URL 与模型 ID 对应同一服务商。
                  {selectedModelProvider?.doc && (
                    <>
                      {" "}
                      文档：
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
          <Button variant="outlined" onClick={onTestAgent} disabled={testingAgent || savingAgent}>
            {testingAgent ? "测试中…" : "测试连接"}
          </Button>
          <Button variant="contained" onClick={onSaveAgent} disabled={savingAgent}>
            {savingAgent ? "保存中…" : "保存配置"}
          </Button>
        </Box>

        <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
          当前：{agentConfig?.provider || agentProvider} • Key：{agentConfig?.has_api_key ? "已配置" : "未配置"}
        </Typography>
      </Paper>
    </Grid>
  );
}

