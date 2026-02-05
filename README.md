# MercuryDesk (MVP)

基于 `report.md` 的一个可运行 MVP：后端提供统一消息模型与“按发信人聚合”的 API，前端提供联系人（发信人）聚合视图，并支持 `mock` / `github` / `imap`（真实邮箱）连接器。

## 快速开始（本机）

### 后端

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

### 前端

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，使用 `Register + Login` 创建账号后，点击顶部 `Sync`（无账号时会自动创建 mock/demo 并拉取演示消息）。
也可以在 `Settings` 里连接 IMAP/GitHub，然后点击顶部 `Sync` 同步所有已连接账户。

## 连接 IMAP 邮箱（真实邮件）

在 `Settings → Connected Accounts` 里选择 `IMAP`，填写主机/端口/用户名/密码后点击 `Add`。
常见示例：

- Gmail：`imap.gmail.com:993`（SSL），建议使用 App Password
- Outlook：`outlook.office365.com:993`（SSL）

如需加密存储 IMAP 密码/Token，请在后端配置 `MERCURYDESK_FERNET_KEY`。

## 头像上传

`Settings → Profile` 支持直接选择图片上传头像（后端通过 `/media` 提供静态访问，前端开发环境已代理 `/media`）。

## AI 助手（可选）

在 `Settings → AI 助手` 中可选择：

- `内置规则`：默认模式，不调用外部 API
- `OpenAI / 兼容接口`：填写 `API Key`（可选改 `Base URL / Model / Temperature`），保存后可点击“测试连接”

如需加密保存 API Key，请在后端配置 `MERCURYDESK_FERNET_KEY`。

## 测试

### 后端测试

```powershell
cd backend
pytest
```

### 前端测试与构建

```powershell
cd frontend
npm test
npm run build
```
