# MercuryDesk 项目完整探索报告

**探索时间**: 2026-02-11  
**项目总代码行数**: ~25,804 行（Python + TypeScript/TSX）  
**项目规模**: 中型全栈应用

---

## 📋 目录

1. [项目概览](#项目概览)
2. [顶级目录结构](#顶级目录结构)
3. [技术栈详解](#技术栈详解)
4. [后端架构](#后端架构)
5. [前端架构](#前端架构)
6. [数据模型](#数据模型)
7. [核心功能模块](#核心功能模块)
8. [配置与部署](#配置与部署)
9. [开发工作流](#开发工作流)

---

## 项目概览

### 项目定位
**MercuryDesk** 是一个**面向个人工作流的统一收件箱平台**，其核心设计理念是：
- 📬 **多源消息聚合**：将来自邮箱、社交媒体、订阅源的消息统一收纳
- 🎴 **杂志式卡片布局**：按发信人分组展示，支持浅色浅蓝/深色纯黑主题
- 🤖 **AI Agent 支持**：集成 OpenAI-Compatible LLM，支持记忆与工具调用
- 🔗 **灵活接入方式**：OAuth、Token、IMAP、邮件转发等多种连接方式

### 核心价值主张
- **消息统一化**：来自不同平台的消息在一个界面内统一展示与管理
- **发信人中心**：按照发信人聚合消息，而非按时间线
- **记忆与智能**：Agent 可以学习用户偏好，提供个性化协助
- **易于扩展**：新的数据源可通过 Connector 模式轻松接入

### 主要功能模块
✅ **消息聚合与管理**
- 按发信人卡片汇总消息
- 未读统计与会话抽屉
- 链接可点击跳转
- 消息标记已读/未读

✅ **多源数据接入**
- 📧 **邮箱**: IMAP、Gmail OAuth、Outlook OAuth
- 🐙 **GitHub**: 通知列表（OAuth 或 Token）
- 📰 **RSS/博客**: 标准 RSS/Atom 解析
- 🎥 **Bilibili**: UP 主动态（爬虫 + RSSHub 回退）
- 🐦 **X (Twitter)**: 用户推文（官方 API + 爬虫 + RSSHub 回退）
- 🎵 **抖音**: 用户视频（Playwright + RSSHub）
- 💄 **小红书**: 用户笔记（Playwright + 爬虫）
- 📰 **微博**: 用户时间线（API + RSSHub）
- 🎭 **Mock**: 演示数据

✅ **AI Agent 功能**
- 智能聊天接口（支持多轮对话与工具调用）
- 短期摘要 + 长期记忆笔记
- 焦点内容提取（关注特定发信人的信息）
- 完整的记忆管理 API

✅ **高级配置**
- OAuth 应用配置管理（UI 内保存，无需改 `.env`）
- Agent 模型目录（来自 `models.dev`）
- 邮件转发接入（最简配置）
- 加密存储敏感信息（支持 Fernet）

---

## 顶级目录结构

```
MercuryDesk/
├── backend/                    # Python FastAPI 后端服务
│   ├── app/                    # 主应用代码（~7,457 行 Python）
│   │   ├── connectors/         # 12+ 数据源连接器
│   │   ├── routers/            # 6 个 API 路由模块
│   │   ├── services/           # 业务服务层（LLM、加密、OAuth 等）
│   │   ├── models.py           # SQLAlchemy ORM 模型（10 张表）
│   │   ├── crud.py             # 数据库操作
│   │   ├── main.py             # FastAPI 应用入口
│   │   ├── settings.py         # 环境变量配置
│   │   ├── schemas.py          # Pydantic 数据验证
│   │   ├── security.py         # JWT 认证
│   │   ├── db.py               # 数据库连接
│   │   └── sync.py             # 同步任务编排
│   ├── tests/                  # 单元测试（~40KB）
│   ├── requirements.txt         # Python 依赖（14 个包）
│   ├── .env.example            # 环境变量模板
│   └── README.md               # 后端说明
│
├── frontend/                   # React + TypeScript 前端
│   ├── src/                    # 前端源代码
│   │   ├── components/         # React 组件（11 个主组件 + 子组件）
│   │   ├── contexts/           # React Context（认证、Toast）
│   │   ├── hooks/              # 自定义 React Hooks
│   │   ├── utils/              # 工具函数
│   │   ├── api.ts              # API 客户端（~500 行）
│   │   ├── theme.tsx           # MUI 主题配置
│   │   ├── App.tsx             # 应用主组件
│   │   └── styles.css          # 全局样式
│   ├── public/                 # 静态资源
│   ├── package.json            # Node.js 依赖
│   ├── vite.config.ts          # Vite 构建配置
│   └── index.html              # HTML 入口
│
├── docs/                       # 项目文档
│   ├── architecture-status.md  # 架构快照表
│   ├── email-forwarding.md     # 邮件转发说明
│   ├── Agent_第一期.md         # Agent 设计文档
│   └── test*.md                # 测试报告
│
├── tests/                      # 集成测试目录
├── README.md                   # 主项目说明（详细的快速启动指南）
├── report.md                   # 项目报告（~33KB）
└── .gitignore                  # Git 忽略规则
```

---

## 技术栈详解

### 后端技术栈
| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **Web 框架** | FastAPI | ≥0.110 | 高性能异步 API 框架 |
| **Web 服务器** | Uvicorn | ≥0.24 | ASGI 应用服务器 |
| **ORM** | SQLAlchemy | ≥2.0 | 数据库 ORM |
| **数据库** | SQLite（默认）/ PostgreSQL | - | 数据持久化 |
| **数据验证** | Pydantic | ≥2.0 | 请求/响应验证 |
| **认证** | python-jose | ≥3.3 | JWT 令牌生成与验证 |
| **加密** | cryptography | ≥41.0 | 敏感信息加密（Fernet） |
| **HTTP 客户端** | httpx | ≥0.25 | 异步 HTTP 请求 |
| **RSS 解析** | feedparser | ≥6.0 | RSS/Atom 源解析 |
| **网页爬虫** | Playwright | ≥1.40 | 无头浏览器自动化 |
| **测试** | pytest | ≥7.0 | 单元测试框架 |
| **LLM** | OpenAI SDK | ≥1.0.0 | 模型 API 调用 |

**核心依赖特点**:
- ✅ 异步优先：FastAPI + Uvicorn + httpx 全异步堆栈
- ✅ 类型安全：Pydantic 与 SQLAlchemy 的强类型支持
- ✅ 爬虫能力：Playwright 支持动态网页抓取
- ✅ 安全加密：支持 Fernet 加密存储敏感数据

### 前端技术栈
| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **框架** | React | ^18.2.0 | UI 组件框架 |
| **语言** | TypeScript | ^5.4.5 | 类型安全的 JavaScript |
| **构建工具** | Vite | ^5.2.0 | 快速构建工具 |
| **UI 组件库** | Material-UI (MUI) | ^7.3.7 | 企业级 UI 组件 |
| **样式解决方案** | Emotion | ^11.14.0 | CSS-in-JS 库 |
| **路由** | React Router | ^7.13.0 | 单页应用路由 |
| **动画** | Framer Motion | ^12.33.0 | 流畅动画库 |
| **数据获取** | SWR | ^2.2.5 | React Hooks 数据获取 |
| **Markdown 渲染** | react-markdown | ^10.1.0 | Markdown 解析渲染 |
| **日期处理** | date-fns | ^4.1.0 | 轻量日期工具库 |
| **测试** | Vitest | ^1.5.0 | 单元测试框架 |
| **测试库** | React Testing Library | ^15.0.7 | React 组件测试 |

**前端架构特点**:
- ✅ 现代化堆栈：React 18 + TypeScript + Vite
- ✅ 响应式 UI：MUI 组件库 + Emotion 样式
- ✅ 实时更新：SWR 支持自动数据刷新与缓存
- ✅ 动画体验：Framer Motion 提供流畅过渡
- ✅ 类型安全：完整的 TypeScript 支持

---

## 后端架构

### 目录结构详解

#### 1. **connectors/** - 数据源连接器（12+ 模块）

每个 Connector 实现 `BaseCrawler` 接口，负责从特定平台抓取数据。

| 文件 | 行数 | 主要功能 |
|------|------|---------|
| `base.py` | ~50 | 基类定义 |
| `mock.py` | ~50 | 模拟数据生成 |
| `github.py` | ~80 | GitHub 通知（REST API） |
| `gmail.py` | ~150 | Gmail API 集成 |
| `outlook.py` | ~120 | Microsoft Graph 集成 |
| `imap.py` | ~250 | IMAP 通用邮箱协议 |
| `feed.py` | ~350 | RSS/Atom 订阅源 |
| `x.py` | **1,200+** | X (Twitter) 多策略爬虫（官方 API + GraphQL + RSSHub + fallback） |
| `bilibili.py` | **900+** | Bilibili UP 主（API + WBI + Playwright + RSSHub） |
| `douyin.py` | ~600 | 抖音用户视频（Playwright + RSSHub） |
| `xiaohongshu.py` | ~700 | 小红书笔记（Playwright + jina.ai + RSSHub） |
| `weibo.py` | ~450 | 微博时间线（m.weibo.cn API + RSSHub） |

**关键设计**:
- **策略模式**：每个 Connector 支持多个抓取策略（主策略 → 回退策略）
- **并发控制**：通过线程池 (`sync_job_max_workers=12`) 管理并发
- **容错机制**：策略失败自动回退（如爬虫失败 → RSSHub）
- **数据规范化**：所有 Connector 输出统一的 `Message` 对象

#### 2. **routers/** - API 路由（6 个模块）

| 文件 | 行数 | 主要端点 |
|------|------|---------|
| `auth.py` | ~150 | `/auth/register`, `/auth/login`, `/auth/me` |
| `accounts.py` | **650+** | 账户管理、OAuth 流程、数据源配置、同步调度 |
| `contacts.py` | ~100 | 联系人列表、详情、删除 |
| `messages.py` | ~30 | 消息列表、标记已读 |
| `agent.py` | **500+** | 聊天、记忆管理、模型配置、工具调用 |
| `inbound.py` | **350+** | 邮件转发接入、验证 |

**关键路由**:
```
POST   /api/v1/auth/register              # 注册
POST   /api/v1/auth/login                 # 登录
GET    /api/v1/accounts                   # 获取已连接账户
POST   /api/v1/accounts/{provider}/sync   # 手动同步
POST   /api/v1/agent/chat                 # AI 对话
GET    /api/v1/agent/config               # Agent 配置
PATCH  /api/v1/agent/config               # 更新 Agent 配置
POST   /api/v1/inbound/forward            # 邮件转发入站
```

#### 3. **services/** - 业务服务层（12 个模块）

| 文件 | 行数 | 职责 |
|------|------|------|
| `llm.py` | ~250 | LLM 调用（支持工具调用、多轮对话） |
| `agent_memory.py` | **500+** | 记忆管理（摘要、笔记、焦点内容提取） |
| `agent_tools.py` | ~150 | Agent 工具定义（搜索消息、获取联系人信息） |
| `oauth_clients.py` | **350+** | OAuth 认证流程（Gmail、Outlook、GitHub） |
| `model_catalog.py` | ~150 | 模型目录缓存与更新 |
| `encryption.py` | ~50 | Fernet 加密/解密 |
| `avatar.py` | ~50 | 头像管理 |
| `feed_urls.py` | ~20 | 预设订阅源 URL |
| `forwarding.py` | ~50 | 邮件转发地址生成 |
| `oauth_state.py` | ~50 | OAuth 状态管理 |
| `summarizer.py` | ~30 | 消息摘要（占位符） |
| `sync_jobs.py` | ~150 | 同步任务管理 |

**核心服务**:
- **LLM**: OpenAI-Compatible 协议，支持工具调用链路
- **Agent Memory**: 短期摘要 + 长期笔记 + 焦点内容
- **OAuth**: 三方平台 (Gmail/Outlook/GitHub) 授权流程
- **Encryption**: 敏感信息加密存储

#### 4. **核心模块**

| 文件 | 行数 | 功能 |
|------|------|------|
| `models.py` | ~450 | SQLAlchemy ORM 模型（10 张表） |
| `crud.py` | ~500 | 数据库增删改查操作 |
| `schemas.py` | ~250 | Pydantic 请求/响应数据模型 |
| `security.py` | ~50 | JWT 令牌生成与验证 |
| `db.py` | ~50 | 数据库连接与会话管理 |
| `sync.py` | **650+** | 同步任务核心编排 |
| `settings.py` | ~55 | 环境变量配置管理 |
| `main.py` | ~75 | FastAPI 应用初始化 |

### 数据库模型（10 张表）

```
users                          # 用户账户
├── id, email, hashed_password, avatar_url

connected_accounts            # 已连接的数据源账户
├── id, user_id, provider (imap/gmail/github/x/bilibili...), identifier
├── access_token, refresh_token, last_synced_at

imap_account_configs          # IMAP 邮箱配置
├── account_id, host, port, username, password (encrypted)

feed_account_configs          # RSS 订阅源配置
├── account_id, feed_url, homepage_url, display_name

forward_account_configs       # 邮件转发配置
├── account_id, inbound_secret

oauth_credential_configs      # OAuth 应用配置（保存 client_id/secret）
├── id, user_id, provider, client_id, client_secret

agent_configs                 # AI Agent 配置
├── user_id, provider, base_url, model, api_key (encrypted)

x_api_configs                 # X (Twitter) API 配置
├── user_id, bearer_token, auth_cookies (JSON)

agent_conversation_memories   # Agent 对话记忆
├── user_id, summary

agent_memory_notes            # Agent 记忆笔记
├── id, user_id, kind, content, source

contacts                      # 联系人
├── id, user_id, display_name, handle, avatar_url, last_message_at

messages                      # 消息
├── id, user_id, contact_id, source, external_id
├── sender, subject, body, body_preview, received_at, is_read, summary
```

### API 认证与授权

- **JWT 令牌**：使用 `python-jose` 生成与验证
- **令牌过期**：默认 24 小时（可配置）
- **安全存储**：敏感信息（Token、密码、API Key）支持 Fernet 加密
- **CORS**：可配置允许的来源

---

## 前端架构

### 目录结构详解

#### 1. **components/** - React 组件（11+ 主组件）

| 组件 | 行数 | 功能 |
|------|------|------|
| `Dashboard.tsx` | ~400 | 主仪表板（消息卡片网格、同步控制） |
| `ContactGrid.tsx` | ~600 | 联系人卡片网格（拖拽、虚拟滚动） |
| `ContactCard.tsx` | ~500 | 单个联系人卡片（消息预览、未读计数） |
| `ConversationDrawer.tsx` | ~550 | 对话抽屉（展开对话历史） |
| `AgentChatPanel.tsx` | **600+** | AI 对话面板（多轮聊天、工具调用、记忆展示） |
| `Settings.tsx` | ~300 | 设置主页面（导航） |
| `settings/sections/AccountsSection.tsx` | **2,400+** | 账户管理（OAuth、Token、IMAP 配置） |
| `settings/sections/AgentSection.tsx` | ~280 | Agent 配置（模型选择、API Key） |
| `settings/sections/AppearanceSection.tsx` | ~50 | 主题切换 |
| `settings/sections/ProfileSection.tsx` | ~90 | 个人资料 |
| `Dashboard/SyncProgressPanel.tsx` | ~50 | 同步进度条 |
| `Dashboard/GmailBindDialog.tsx` | ~50 | Gmail 绑定提示 |
| `TopBar.tsx` | ~220 | 顶部导航栏 |
| `Login.tsx` | ~100 | 登录页 |
| `login/LoginPanel.tsx` | ~200 | 登录表单 |
| `ErrorBoundary.tsx` | ~90 | 错误边界 |
| `GuideCards.tsx` | ~200 | 引导卡片 |
| `NotFound.tsx` | ~10 | 404 页面 |
| `ContactSkeleton.tsx` | ~50 | 加载骨架屏 |

**关键组件特点**:
- **Dashboard**: 使用卡片网格展示所有联系人，支持拖拽排序、虚拟滚动
- **AccountsSection**: 高度复杂，支持多个数据源的配置与管理
- **AgentChatPanel**: 完整的对话 UI，支持工具调用与记忆注入

#### 2. **contexts/** - React Context（全局状态）

| 文件 | 功能 |
|------|------|
| `AuthContext.tsx` | 认证状态（用户、登录状态、登出） |
| `ToastContext.tsx` | 消息通知（Toast/Snackbar） |

#### 3. **hooks/** - 自定义 React Hooks

| 文件 | 功能 |
|------|------|
| `useConfirmDialog.tsx` | 确认对话框逻辑 |
| `useDebouncedValue.ts` | 防抖值 |

#### 4. **utils/** - 工具函数

| 文件 | 行数 | 功能 |
|------|------|------|
| `contentPreview.ts` | ~400 | HTML/Markdown 内容预览生成 |
| `oauthPopup.ts` | ~100 | OAuth 弹窗管理 |

#### 5. **其他文件**

| 文件 | 功能 |
|------|------|
| `api.ts` | API 客户端（所有后端调用的入口） |
| `theme.tsx` | MUI 主题配置（浅色、深色主题） |
| `App.tsx` | 应用主组件与路由设置 |
| `main.tsx` | React DOM 渲染入口 |
| `styles.css` | 全局样式 |

### 前端 API 调用架构

**api.ts** (~500 行) 提供完整的类型定义与 API 包装：

```typescript
// 类型定义
export type User, ConnectedAccount, Contact, Message, AgentConfig, ...

// 认证
export async function register(email, password)
export async function login(email, password)
export async function logout()

// 账户管理
export async function getConnectedAccounts()
export async function syncAccount(provider)
export async function deleteAccount(accountId)

// 消息
export async function getContacts(options)
export async function getMessages(contactId)
export async function markMessagesAsRead(messageIds)

// Agent
export async function agentChat(messages, tools, useMemory)
export async function getAgentConfig()
export async function updateAgentConfig(config)
export async function getAgentMemory()

// OAuth
export async function startOAuth(provider)
export async function completeOAuth(provider, code)

// 工具函数
export function getToken()
export function setToken(token)
export class ApiError extends Error
```

### 数据流

1. **获取数据**: SWR Hook 自动处理缓存、刷新、错误重试
2. **显示数据**: React 组件订阅 SWR 数据，自动渲染
3. **更新数据**: 调用 API 后，通过 `mutate()` 触发 SWR 重新验证
4. **错误处理**: ApiError 捕获 HTTP 错误，显示为 Toast 通知

---

## 数据模型

### 用户相关
```python
User(
  id: int,
  email: str,          # 唯一
  hashed_password: str,
  avatar_url: str,
  created_at: datetime
)
```

### 账户管理
```python
ConnectedAccount(
  id: int,
  user_id: int,
  provider: str,         # 'imap', 'gmail', 'github', 'x', 'bilibili', ...
  identifier: str,       # email 或 username
  access_token: str,     # OAuth/API token
  refresh_token: str,    # OAuth refresh token
  last_synced_at: datetime
)

# 扩展配置（多态关系）
ImapAccountConfig         # host, port, username, password (encrypted)
FeedAccountConfig         # feed_url, homepage_url, display_name
ForwardAccountConfig      # inbound_secret (用于验证转发邮件)
OAuthCredentialConfig     # client_id, client_secret (OAuth 应用配置)
```

### 消息与联系人
```python
Contact(
  id: int,
  user_id: int,
  display_name: str,
  handle: str,           # email 或 username
  avatar_url: str,
  last_message_at: datetime
)

Message(
  id: int,
  user_id: int,
  contact_id: int,
  source: str,           # 'email', 'github', 'news', 'x', ...
  external_id: str,      # 平台方消息 ID（用于去重）
  sender: str,
  subject: str,
  body: str,
  body_preview: str,     # 摘要用于列表展示
  received_at: datetime,
  is_read: bool,
  summary: str           # LLM 生成的摘要（可选）
)
```

### Agent 与记忆
```python
AgentConfig(
  user_id: int,
  provider: str,         # 'rule_based' 或 'openai'
  base_url: str,
  model: str,
  temperature: float,
  api_key: str           # (encrypted)
)

AgentConversationMemory(
  user_id: int,
  summary: str           # 对话总结
)

AgentMemoryNote(
  id: int,
  user_id: int,
  kind: str,             # 'note', 'preference', 'action', ...
  content: str,
  source: str            # 来源（如 'contact_name'）
)
```

---

## 核心功能模块

### 1. 同步与爬虫系统 (`sync.py`)

**核心流程**：
1. 用户触发"同步全部"或定时任务调用 `sync_account(user_id, provider)`
2. 根据 Provider 选择对应的 Connector
3. Connector 执行主策略，失败则回退到备选策略
4. 抓取的消息规范化为 `Message` 对象
5. 写入数据库，更新 `Contact.last_message_at`

**并发控制**：
```python
# backend/app/settings.py
sync_job_max_workers = 12      # 同步任务线程池
crawler_rsshub_parallelism = 12 # RSSHub 镜像并发
```

**特殊处理**：
- **X (Twitter)**: 官方 API → GraphQL Cookie → RSSHub → Fallback Feed
- **Bilibili**: API → WBI → jina.ai → RSSHub → Playwright
- **Douyin/小红书**: Playwright → RSSHub 多镜像

### 2. OAuth 认证系统 (`services/oauth_clients.py`)

**支持的三方平台**：
- Gmail (Google Cloud OAuth)
- Outlook (Microsoft Entra OAuth)
- GitHub (GitHub Developers OAuth)

**流程**：
1. 用户点击"一键授权"
2. 前端弹窗打开 `https://accounts.google.com/o/oauth2/auth?...`
3. 用户授权，重定向到 `backend/callback`
4. 后端交换 Authorization Code 为 Access Token
5. 保存 Token 到 `ConnectedAccount.access_token`
6. 前端关闭弹窗，开始首次同步

**支持的 Token 刷新**：
- Gmail/Outlook: 自动刷新 Refresh Token
- GitHub: Token 不过期，但可手动更新

### 3. 消息聚合与展示

**后端聚合逻辑**：
```python
# 按发信人分组查询
SELECT contact, COUNT(*) as unread_count, MAX(received_at)
FROM messages
WHERE user_id = ? AND is_read = False
GROUP BY contact_id
ORDER BY MAX(received_at) DESC
```

**前端展示**：
- **ContactGrid**: 网格布局，每个卡片代表一个发信人
- **ContactCard**: 显示发信人头像、名称、未读计数、最新消息预览
- **ConversationDrawer**: 展开查看该发信人的所有消息

### 4. AI Agent 系统

**架构分层**：
```
API 层 (routers/agent.py)
  ↓
Prompt 组装 (系统提示 + 记忆上下文)
  ↓
LLM 调用 (services/llm.py - OpenAI-Compatible)
  ↓
工具执行 (agent_tools.py - search_messages / get_contact_info)
  ↓
记忆更新 (agent_memory.py - 摘要、笔记、焦点)
```

**工具调用链路**：
- 最多 3 轮对话 × 6 次工具调用
- 支持动态工具白名单（每条消息可指定允许哪些工具）
- 工具执行结果注入下一轮 LLM 输入

**记忆系统**：
1. **短期摘要**: 每次对话后生成摘要，存储在 `AgentConversationMemory.summary`
2. **长期笔记**: 用户手工创建笔记，存储在 `AgentMemoryNote`
3. **焦点内容**: 自动从最近消息中提取关键信息（基于评分）

### 5. 邮件转发接入 (`routers/inbound.py`)

**工作流**：
1. 用户在设置中选择"邮件转发接入"
2. 后端生成专属转发地址（如 `md-xxx@inbox.example.com`）
3. 用户在原邮箱后台添加自动转发规则
4. 新邮件到达后，MTA 转发到系统，调用 `/api/v1/inbound/forward`
5. 后端验证 `inbound_secret`，写入数据库

**关键参数**：
```python
MERCURYDESK_FORWARD_INBOUND_DOMAIN = "inbox.example.com"
```

---

## 配置与部署

### 环境变量清单

#### 数据库与密钥
```env
MERCURYDESK_DATABASE_URL=sqlite+pysqlite:///./mercurydesk.db
MERCURYDESK_SECRET_KEY=change-me
MERCURYDESK_FERNET_KEY=                              # 用于加密敏感信息
```

#### CORS 与前端
```env
MERCURYDESK_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MERCURYDESK_MEDIA_DIR=./media
MERCURYDESK_FRONTEND_URL=http://127.0.0.1:5173
MERCURYDESK_API_PUBLIC_BASE_URL=http://127.0.0.1:8000
```

#### OAuth 应用（全局默认）
```env
MERCURYDESK_GMAIL_CLIENT_ID=...
MERCURYDESK_GMAIL_CLIENT_SECRET=...
MERCURYDESK_OUTLOOK_CLIENT_ID=...
MERCURYDESK_OUTLOOK_CLIENT_SECRET=...
MERCURYDESK_GITHUB_CLIENT_ID=...
MERCURYDESK_GITHUB_CLIENT_SECRET=...
```

#### 爬虫配置
```env
MERCURYDESK_RSSHUB_BASE_URL=https://rsshub.app
MERCURYDESK_SYNC_JOB_MAX_WORKERS=12
MERCURYDESK_CRAWLER_HEADLESS=false
MERCURYDESK_CRAWLER_USE_PERSISTENT_LOGIN=true
MERCURYDESK_CRAWLER_BROWSER_DATA_DIR=./browser_data
MERCURYDESK_CRAWLER_RSSHUB_PARALLELISM=12
MERCURYDESK_CRAWLER_PLAYWRIGHT_POLL_SECONDS=10
```

#### LLM 模型目录
```env
MERCURYDESK_MODELS_CATALOG_URL=https://models.dev/api.json
MERCURYDESK_MODELS_CATALOG_REFRESH_SECONDS=3600
```

#### 邮件转发域名
```env
MERCURYDESK_FORWARD_INBOUND_DOMAIN=inbox.example.com
```

### 快速启动指南

#### 后端启动
```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

#### 前端启动
```powershell
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

#### 数据库初始化
- SQLite：自动在 `backend/mercurydesk.db` 创建
- PostgreSQL：需提前创建数据库，配置 `MERCURYDESK_DATABASE_URL`

### 测试命令

```powershell
# 后端单元测试
cd backend
pytest

# 前端测试
cd frontend
npm test
npm run build
```

---

## 开发工作流

### 添加新的数据源（Connector）

**步骤**：
1. 在 `backend/app/connectors/` 创建新文件 `myplatform.py`
2. 继承 `BaseCrawler` 并实现 `crawl()` 方法
3. 返回 `list[Message]` 或 `list[Contact]`
4. 在 `sync.py` 中注册 Connector
5. 在 `routers/accounts.py` 添加配置端点
6. 在前端 `components/settings/sections/AccountsSection.tsx` 添加 UI

### 添加新的 API 端点

**步骤**：
1. 在 `routers/` 中创建或修改文件
2. 使用 `@router.get()` / `@router.post()` 装饰器
3. 定义请求/响应 Schema（在 `schemas.py`）
4. 使用 CRUD 函数访问数据库
5. 在 `main.py` 注册路由
6. 在前端 `api.ts` 添加调用函数

### 添加新的 Agent 工具

**步骤**：
1. 在 `services/agent_tools.py` 定义工具函数
2. 在工具函数上标注参数与返回类型
3. 在 `routers/agent.py` 中注册工具
4. 在 LLM Prompt 中说明工具用途
5. 在前端 `AgentChatPanel.tsx` 添加工具选择 UI（可选）

### 修改主题

**步骤**：
1. 编辑 `frontend/src/theme.tsx`（MUI 主题配置）
2. 修改颜色、字体、间距等
3. 主题切换逻辑在 `AppearanceSection.tsx`

### 数据库迁移

由于使用 SQLite，暂无完整迁移框架，但有简单的列添加脚本：
```python
# backend/app/main.py - _add_missing_columns()
```

如果需要复杂迁移，建议使用 Alembic：
```bash
pip install alembic
alembic init migrations
```

---

## 项目统计

### 代码规模
- **总行数**: ~25,804 行
- **Python 代码**: ~7,457 行（backend/app）
- **TypeScript/TSX 代码**: ~8,000+ 行（frontend/src）
- **测试代码**: ~2,000+ 行
- **文档**: ~10,000+ 行

### 文件统计
| 类型 | 数量 |
|------|------|
| Python 文件 | ~50+ |
| TypeScript/TSX 文件 | ~40+ |
| 配置文件 | 10+ |
| 文档文件 | 10+ |
| 测试文件 | 8+ |

### 依赖统计
| 类型 | 数量 |
|------|------|
| Python 依赖 | 14 个（核心） |
| Node.js 依赖 | 18 个 |

---

## 关键设计决策

### 1. **Connector 模式**
- 每个数据源独立实现，便于扩展
- 支持多策略回退，提高可靠性

### 2. **OAuth + Token 双支持**
- OAuth：用户友好的一键授权
- Token：面向高级用户的直接连接

### 3. **消息规范化**
- 所有数据源的消息统一为 `Message` 模型
- 支持按发信人聚合展示

### 4. **AI Agent 作为附加功能**
- 独立的 `/api/v1/agent` 路由
- 可选配置，不影响核心消息功能

### 5. **前端 SWR 数据获取**
- 自动缓存与重新验证
- 降低网络请求频率
- 支持离线使用

### 6. **加密存储敏感信息**
- 使用 Fernet（对称加密）
- 可选启用，通过 `MERCURYDESK_FERNET_KEY` 配置

---

## 已知局限与改进方向

### 当前局限
1. ⚠️ **SQLite 限制**: 生产环境应使用 PostgreSQL
2. ⚠️ **爬虫脆弱性**: 网页爬虫易受平台 HTML 结构变化影响
3. ⚠️ **RSSHub 依赖**: 某些平台的回退策略依赖外部 RSSHub 服务
4. ⚠️ **Agent 记忆容量**: 长期记忆暂无容量限制与归档机制

### 潜在改进
- [ ] 实现 Alembic 数据库迁移框架
- [ ] 添加消息搜索索引（Elasticsearch/Milvus）
- [ ] 实现 Agent 记忆的向量存储与语义搜索
- [ ] 支持消息加密存储
- [ ] 实现消息去重与聚合算法优化
- [ ] 添加消息标签与分类系统
- [ ] 支持自定义工作流（IFTTT 风格）
- [ ] 实现消息推送通知（WebSocket）

---

## 总结

**MercuryDesk** 是一个设计精良的个人收件箱系统，具有以下特点：

✅ **架构清晰**：分层设计，Connector 模式支持无限扩展  
✅ **功能完整**：支持 12+ 数据源、OAuth/Token 认证、AI Agent、邮件转发  
✅ **技术先进**：异步优先、类型安全、现代化前后端栈  
✅ **易于部署**：零配置启动（SQLite）、环境变量驱动  
✅ **用户体验**：杂志式卡片布局、流畅动画、深浅主题支持  

项目适合作为：
- 个人生产力工具
- 开源学习项目
- 企业内部通知聚合平台
- SaaS 应用原型

---

**探索完成时间**: 2026-02-11  
**探索级别**: Very Thorough ✨
