# MercuryDesk

面向个人工作流的统一收件箱：按发信人聚合消息，前端为杂志式卡片布局，支持邮箱与多种订阅源。

## 已实现能力

- 消息聚合：按发信人卡片汇总，支持未读统计、会话抽屉、链接可点击跳转。
- 数据来源：
  - 邮箱 IMAP（真实邮箱）
  - GitHub 通知（支持 OAuth 一键授权 / Token 直连）
  - RSS / Blog 订阅
  - Bilibili 指定 UP 主动态（基于 B 站公开页面抓取，失败时回退订阅源）
  - X 指定用户更新（基于 X 公共网页接口抓取）
  - Mock 演示数据
- 主题：浅色浅蓝、深色纯黑（深蓝强调色），整体保持杂志化排版风格。
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

### 连接 Gmail / Outlook / GitHub（OAuth 推荐）

登录后如果检测到尚未绑定 Gmail，首页会自动弹窗提示授权绑定（可稍后跳过）。

1. 在 Google Cloud / Microsoft Entra / GitHub Developers 创建 OAuth 应用（Web）
2. 将回调地址配置为：
   - `http://127.0.0.1:8000/api/v1/accounts/oauth/gmail/callback`
   - `http://127.0.0.1:8000/api/v1/accounts/oauth/outlook/callback`
   - `http://127.0.0.1:8000/api/v1/accounts/oauth/github/callback`
3. 在设置页直接保存 OAuth 配置（无需改 `.env`）：
   - 可手动粘贴 `client_id/client_secret`
   - Gmail/Outlook 可直接导入 OAuth JSON 自动保存
4. 保存后点击“一键授权”完成绑定（GitHub 会请求 Notifications 权限）。

GitHub 也支持旧版 Token 方式（无需 OAuth 应用）：

1. 在设置页选择 `GitHub（OAuth / Token）`
2. 将“GitHub 接入方式”切为 `手动 Token（兼容旧方式）`
3. 填写 Token 后直接“连接并同步”
4. 建议 Token 使用 Classic PAT 并包含 `notifications` 权限

> 仍可继续使用 `.env` 方式作为全局默认配置（可选）。

常见报错：`gmail OAuth 未配置 client_id/client_secret`

- 确认已在 `backend/.env`（或系统环境变量）设置：
  - `MERCURYDESK_GMAIL_CLIENT_ID`
  - `MERCURYDESK_GMAIL_CLIENT_SECRET`
- 确认后端进程重启后生效，并且使用与回调地址一致的启动方式（推荐在 `backend` 目录启动）。

PowerShell 临时设置示例（当前终端有效）：

```powershell
$env:MERCURYDESK_GMAIL_CLIENT_ID="你的_client_id"
$env:MERCURYDESK_GMAIL_CLIENT_SECRET="你的_client_secret"
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

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
- Bilibili：输入 UP 主 UID（默认走公开页面抓取）
- X：输入用户名（`@` 可省略，默认走 X 公共网页接口抓取）

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
- `MERCURYDESK_FRONTEND_URL`（OAuth 回跳前端地址，默认 `http://127.0.0.1:5173`）
- `MERCURYDESK_API_PUBLIC_BASE_URL`（转发入口公开地址，默认 `http://127.0.0.1:8000`）
- `MERCURYDESK_OAUTH_REDIRECT_BASE_URL`（OAuth 回调基地址，默认 `http://127.0.0.1:8000`）
- `MERCURYDESK_FORWARD_INBOUND_DOMAIN`（转发专属地址域名，例如 `inbox.example.com`）
- `MERCURYDESK_GMAIL_CLIENT_ID` / `MERCURYDESK_GMAIL_CLIENT_SECRET`
- `MERCURYDESK_OUTLOOK_CLIENT_ID` / `MERCURYDESK_OUTLOOK_CLIENT_SECRET`
- `MERCURYDESK_GITHUB_CLIENT_ID` / `MERCURYDESK_GITHUB_CLIENT_SECRET`

## 邮件转发接入（只填邮箱）

在设置页选择“邮箱转发接入（更简）”后：

1. 填写你要接入的邮箱地址（仅用于标识）
2. 系统生成专属转发地址（例如 `md-xxx@inbox.example.com`）
3. 在原邮箱后台添加自动转发规则到该地址
4. 新邮件将通过 `/api/v1/inbound/forward` 写入收件箱

详细机制与部署说明见 `docs/email-forwarding.md`。

## 验证命令

```powershell
cd backend
pytest

cd ../frontend
npm test
npm run build
```
