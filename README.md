# MercuryDesk

面向个人工作流的统一收件箱：按发信人聚合消息，前端为杂志式卡片布局，支持邮箱与多种订阅源。

## 已实现能力

- 消息聚合：按发信人卡片汇总，支持未读统计、会话抽屉、链接可点击跳转。
- 数据来源：
  - 邮箱 IMAP（真实邮箱）
  - GitHub 通知
  - RSS / Blog 订阅
  - Bilibili 指定 UP 主动态（基于 RSSHub）
  - X 指定用户更新（基于 RSSHub）
  - Mock 演示数据
- 主题：浅色牛皮纸、深色纯黑，整体保持杂志化排版风格。
- Agent 配置：
  - 支持内置规则模式
  - 支持 OpenAI-Compatible 调用链路
  - 模型目录来自 `https://models.dev/api.json`（后端缓存）

## 快速启动

### 1) 后端

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 2) 前端

```powershell
cd frontend
npm install
npm run dev
```

打开 `http://localhost:5173`，注册并登录后即可在「设置」中连接来源。

## 最简配置流程（中文界面）

### 连接真实邮箱（IMAP）

1. 进入 `设置 -> 已连接来源 -> 选择邮箱（IMAP）`
2. 选择邮箱服务商，填写邮箱与授权码/密码
3. 点击「连接并同步」

常用 IMAP：

- Gmail: `imap.gmail.com:993` (SSL)
- Outlook/M365: `outlook.office365.com:993` (SSL)
- QQ: `imap.qq.com:993` (SSL)
- 163: `imap.163.com:993` (SSL)

### 连接订阅源

- RSS/Blog：输入 feed URL（可一键填入 Claude Blog）
- Bilibili：输入 UP 主 UID
- X：输入用户名（`@` 可省略）

## Agent / LLM 配置

- 模型目录接口：`GET /api/v1/agent/catalog`
- 配置接口：`GET/PATCH /api/v1/agent/config`
- 测试接口：`POST /api/v1/agent/test`

在前端设置页可直接：

1. 选择服务商（来自 models.dev）
2. 选择模型（若该服务商公开模型列表）
3. 填写 Base URL / API Key
4. 保存并测试连接

> 当前执行链路为 OpenAI-Compatible 请求格式，请保证所选服务商与 Base URL、模型 ID 一致。

## 环境变量（后端）

- `MERCURYDESK_DATABASE_URL`
- `MERCURYDESK_SECRET_KEY`
- `MERCURYDESK_FERNET_KEY`（可选，建议开启，用于加密保存 Token/密码/API Key）
- `MERCURYDESK_CORS_ORIGINS`
- `MERCURYDESK_MEDIA_DIR`
- `MERCURYDESK_RSSHUB_BASE_URL`（默认 `https://rsshub.app`）
- `MERCURYDESK_MODELS_CATALOG_URL`（默认 `https://models.dev/api.json`）
- `MERCURYDESK_MODELS_CATALOG_REFRESH_SECONDS`（默认 `3600`）

## 验证命令

```powershell
cd backend
pytest

cd ../frontend
npm test
npm run build
```
