# 项目实现方案：统一信息聚合与智能摘要平台

## 概述

本项目旨在构建一款**统一信息聚合软件**，通过绑定多个邮箱、GitHub 及其他平台账号，定期抓取各平台的“未抓取过”的信息，并在前端以**发信人为核心**呈现消息摘要。用户可在同一界面查看来自不同邮箱的邮件，同时使用智能代理（Agent）自动生成摘要、润色回复，并提供股市建议或 GitHub 关注建议等扩展服务。此类产品已有成功实践，例如 Unibox 将所有邮件按发件人聚合展示【719016143334727†L32-L44】，Spark 支持按发件人或域名分组【354842816371798†L174-L201】，证明设计理念可行。本方案将从需求分析、系统架构、技术选型、安全性与隐私、开发流程及风险分析等角度提供实现建议。

## 需求分析

### 核心功能

1. **用户注册与账号绑定**
   - 用户以某一个主邮箱注册系统；随后可绑定多个邮箱账号（IMAP/POP、Gmail API）、GitHub 账号以及其他平台（新闻、股市等）。
   - 绑定过程通过 OAuth 2.0 授权，系统存储访问令牌并加密保存，避免明文密码。

2. **信息抓取与聚合**
   - 后端定时任务（Cron 或调度器）从各账号拉取未读或新消息，并记录抓取时间，防止重复抓取。
   - 邮件抓取支持 IMAP/POP3 及 Gmail/Outlook 等 REST API。GitHub 集成通过官方 API 获取通知、Pull Request 评论等信息。
   - 其他平台（新闻、股票）利用公开 API 或 Webhook，按用户配置抓取。
   - 将抓取到的消息统一存入数据库，按照发件人、来源和时间打上标签，便于聚合展示。

3. **界面设计**
   - 前端以**发信人/联系人**为主要分类，类似于聊天应用。左侧为联系人列表，按照最近交流时间排序，每个联系人只出现一次【719016143334727†L32-L44】；点击联系人后展示与该人的所有往来邮件/通知。
   - 每个联系人项包含头像/标识、来自哪个平台的小图标（如 Gmail “G” 图标、GitHub 图标）、未读计数等。
   - 主面板展示摘要信息和部分内容，点击后弹出详细信息面板，可查看完整邮件并回复。回复时系统自动选择对应的发件邮箱，但用户可手动切换。
   - 提供全局搜索（按发件人、主题、正文等），以及过滤器（按平台、时间、关键词等）。

4. **智能代理（Agent）功能**
   - **摘要生成**：使用自然语言处理模型对邮件或通知进行摘要。可部署本地模型或调用外部 API，注意遵守数据隐私政策。模型应支持中文及主要外语。
   - **邮件润色与回复建议**：基于上下文为用户生成邮件回复草稿，支持调整语气（正式/友好等）。
   - **个性化建议**：针对股票信息提供简要分析或提醒；针对 GitHub 活动推荐关注仓库或贡献者；针对新闻推送提出阅读优先级。未来可根据需求扩展更多 Agent 能力。

5. **通知与实时更新**
   - 支持桌面和移动端推送通知；用户可自定义优先级（例如特定发件人通知立即推送，其余批量推送）。
   - 提供通知中心查看所有通知，并允许批量标记已读或归档。

6. **用户设置与偏好**
   - 账户管理：添加/移除邮箱和第三方账号；管理 OAuth 授权；查看同步状态。
   - 隐私设置：选择哪些账户参与统一聚合；控制某些发件人不被聚合。
   - agent 功能开关与模型选项：用户可以启用或关闭摘要生成、回复润色等功能。

### 非功能需求

- **性能与扩展性**：支持上万用户同时在线，后台消息抓取任务应可水平扩展。消息聚合和 AI 摘要需要缓存和异步处理，提高响应速度。
- **安全性**：令牌和用户数据必须加密存储，传输采用 HTTPS；遵守 GDPR 等隐私法规。
- **可用性**：界面简洁、响应迅速，支持暗色/浅色模式，适配桌面和移动端。
- **可维护性**：采用模块化架构和容器化部署，方便维护与更新。

## 系统架构设计

### 总体架构

采用**前后端分离**的客户端/服务器架构，后端以微服务或模块化单体方式实现，前端使用现代 Web 框架（如 React/Next.js 或 Vue）或跨平台框架（如 Flutter）。架构包含以下关键组件：

- **用户认证与授权服务**：处理用户注册、登录、OAuth 授权，颁发 JWT 访问令牌。
- **连接器管理服务（Connector Manager）**：管理与各外部平台的接口（IMAP、Gmail API、GitHub API、新闻和股市 API）；负责定时拉取数据、处理异步任务和错误重试。
- **消息存储与索引服务**：将抓取的邮件、通知等统一保存，建立索引（发件人、时间、主题）以支持快速查询和全文搜索；建议使用关系型数据库（PostgreSQL）与全文搜索引擎（Elasticsearch）。
- **聚合与联系人服务**：对多来源信息进行聚合，按发件人/联系人分组，生成会话列表。需要联系人匹配模块识别同一发件人的多个邮件地址。
- **智能代理服务**：调用语言模型生成摘要、回复建议、情感分析等；可以通过异步消息队列（RabbitMQ/Kafka）与聚合服务解耦。
- **前端应用**：负责呈现统一界面，调用后端 API 获取数据，并与智能代理交互展示结果。
- **通知服务**：发送实时通知（WebSocket、Server-Sent Events 或第三方推送），支持桌面通知和移动端推送。
- **监控与日志**：记录系统运行状态，跟踪抓取任务、API 调用、错误等。

下图描述了高层组件关系（伪图示）：

```
+----------------------+            +---------------------------+
|      前端应用         |<----------|  API 网关 / BFF            |
|   (React/Vue/Flutter) |           +-----------+---------------+
+----------------------+                        |
         ^                                        v
         |                            +--------------------------+
         |                            |   用户认证服务           |
         |                            +--------------------------+
         |                                        |
         |                                        v
         |                            +--------------------------+
         |                            |  聚合与联系人服务         |
         |                            +------------+-------------+
         |                                         |
         |                                         v
+--------+--------+     +----------------------+   +---------------------------+
|连接器管理服务    |--> |消息存储与索引服务    |-->|  智能代理服务 (AI/NLP)    |
| (Mail/GitHub/API)|     +----------------------+   +---------------------------+
+------------------+
```

### 后端服务设计

1. **认证与授权模块**
   - 使用 OAuth 2.0 + OpenID Connect 实现第三方账号授权。用户登录时获取 JWT。可采用 Keycloak、Auth0 或自研实现。
   - 提供单点登录（SSO）支持，方便未来扩展其他应用。
   - 对外 API 通过 API 网关或 BFF（Backend for Frontend）暴露，统一处理认证验证、节流和权限。

2. **连接器管理服务**
   - 为不同平台实现**连接器适配器**，包括：
     - **邮件适配器**：使用 IMAP/POP3 客户端库（如 Python 的 `imaplib`、Node.js 的 `imapflow`）或第三方 SDK（Gmail/Outlook API）。支持 OAuth 2.0 授权，定时抓取新邮件并转换为统一消息对象。
     - **GitHub 适配器**：使用 GitHub 官方 REST GraphQL API 获取通知、Issue/PR 评论等。支持 Webhook 接收实时事件。
     - **新闻和股市适配器**：与用户选择的新闻 API、股票行情 API 集成，定时拉取最新数据。
   - 调度器（如 `Celery Beat` + `Celery` 或 `Node-Cron`）按用户设定的频率触发抓取任务；使用消息队列（RabbitMQ/Kafka）将消息流交给后续服务处理。
   - 每次抓取记录 `last_fetch_time`，避免重复；错误时记录状态并重试。

3. **消息存储与索引**
   - **关系型数据库（PostgreSQL）**存储用户、联系人、平台配置、消息元数据（发件人、收件人、主题、时间戳、来源、状态）。
   - 消息正文和附件可存储于对象存储（如 Amazon S3、MinIO）或压缩后存放数据库；索引内容用于全文检索可存入 **Elasticsearch**。
   - 构建联系人表，使用姓名/邮件地址和第三方账号 ID 对应同一联系人。可采用简单的唯一性规则或引入机器学习算法进行实体匹配。

4. **聚合与联系人服务**
   - 负责将不同来源的消息按照发件人聚合成会话列表。逻辑包括：
     - 根据联系人表合并同一发件人的多个邮箱/账号。若用户未明确连接，应提供合并操作（手动或自动建议）。
     - 为每个联系人维护会话记录，包含未读数、最新消息摘要、关联平台标签。
     - 提供分页查询和过滤接口，支持按时间、来源、关键字搜索。
     - 支持线程视图：点击会话后显示与该联系人及该主题的邮件线程。

5. **智能代理服务**
   - **摘要生成**：调用本地模型或第三方 LLM（如 OpenAI GPT、Claude 或自研模型）。采用队列异步处理，减轻前端等待时间。
   - **回复辅助**：根据历史对话生成回复建议。允许用户选择不同语气或模板。
   - **领域模型集成**：针对股市、GitHub 等特定领域，训练小型模型或调用专用 API（如财务分析 API）生成建议。
   - 为保障隐私，可以将模型部署在私有云/本地服务器；若使用第三方 API，应在隐私政策中明确数据范围，或只发送摘要而非完整邮件内容。

6. **通知服务**
   - 前端通过 WebSocket 或 Server-Sent Events 订阅通知；后端在新消息到达或摘要生成完成后推送事件。
   - 可集成第三方推送（如 Firebase Cloud Messaging）实现移动端通知。

7. **监控与日志**
   - 使用 Prometheus + Grafana 收集各微服务的指标（CPU、内存、队列深度、API 延迟）。
   - 使用集中日志（ELK 或 Loki）跟踪抓取错误、API 调用错误等。
   - 设置告警规则，发现第三方 API 失败、令牌过期等情况及时通知运维。

### 前端设计

1. **技术选型**：
   - **Web 端**：使用 React 或 Vue + TypeScript，借助组件库（Ant Design、MUI）快速搭建 UI；使用 Redux/MobX 管理状态。
   - **移动端**：可使用 Flutter 或 React Native 与 Web 共享核心逻辑，统一交互体验。
   - **性能优化**：前端通过虚拟滚动、按需加载数据、缓存异步请求等提升体验。

2. **界面布局**：
   - 主面板直接呈现多个联系人卡片（小面板），不再使用左侧侧边栏。每个卡片代表一个发件人或联系人，显示名称、头像/图标、最近消息时间、未读条数以及来源图标。卡片按照最近交流时间排序，支持纵向或网格布局，当联系人较多时可滚动或分页；顶部或浮动搜索框可用于快速过滤联系人。
   - 点击某个联系人卡片会打开该联系人的会话详情：可在悬浮窗口、侧边抽屉或卡片展开区域中显示摘要列表和全文邮件，包括附件查看、回复/转发/标记等操作。这样用户无需离开主面板即可处理邮件，保持对其他联系人卡片的可见性。
   - 顶部导航栏仍提供全局搜索、通知中心入口、用户设置入口等功能；通知中心集中显示来自各联系人卡片的新消息提醒。
   - 提供暗色/浅色等不同主题，并在联系人卡片中加入所属平台的品牌颜色或小图标，以帮助用户快速识别不同来源。

3. **交互和可用性**：
   - 支持键盘快捷键（例如快速搜索、快速回复）；
   - 未读与已读状态同步服务端；
   - 支持拖拽整理卡片顺序或固定常用联系人；
   - 对移动端适配：底部导航切换模块，滑动手势查看/归档/删除邮件。

## 技术选型

- **后端语言和框架**：
  - Python（FastAPI/Django）或 Node.js（Express/NestJS）均可。Python 在处理邮件、NLP 与科学计算方面生态成熟，FastAPI 支持异步 I/O；Node.js 更适合处理高并发与实时应用。
- **数据库**：PostgreSQL 存储结构化数据；Elasticsearch 存储全文索引；Redis 缓存会话和临时数据。
- **消息队列**：RabbitMQ 或 Kafka 用于异步任务、队列式抓取与 AI 请求。
- **部署方式**：容器化（Docker + Kubernetes），每个服务可独立扩展；使用 CI/CD 流水线自动测试与部署。
- **第三方库/服务**：
  - 邮件抓取：`imaplib`/`imapflow`、`google-api-python-client`、`microsoft-graph`。
  - GitHub 集成：`PyGithub`、`octokit`。
  - NLP 模型：Hugging Face Transformers（部署语言模型）或调用 OpenAI API。
  - 授权：`Authlib`、`passport.js` 或第三方身份提供商。

## 安全性与隐私考虑

- **加密存储**：所有外部平台访问令牌通过密钥管理服务（如 HashiCorp Vault、AWS KMS）加密存储。数据库使用透明数据加密。
- **通信安全**：所有服务使用 HTTPS/TLS；内部服务间可使用 mTLS 确保双向认证。
- **最小权限**：采用细粒度的访问控制，限制每个连接器的 API 权限只用于读取必要数据；用户可随时撤销授权。
- **数据隔离**：不同用户的消息数据使用逻辑隔离，避免串读；组织用户可能需要多租户隔离。
- **合规性**：遵守 GDPR 等法规，为用户提供数据导出和删除的功能；隐私政策中说明数据处理方式。
- **防止滥用**：对外 API 设置速率限制，防止恶意请求；接入第三方平台时遵守其服务条款，避免被判定为爬虫或滥用。

## 开发流程与阶段规划

1. **阶段 1：最小可行产品（MVP）**
   - 实现用户认证系统、邮箱账号绑定（IMAP/Gmail/Outlook），邮件抓取和存储。
   - 完成按发件人聚合的核心逻辑，提供联系人列表和会话视图。
   - 简单的前端界面、基础搜索与查看邮件功能。
   - 部署本地或云端测试环境，收集早期用户反馈。

2. **阶段 2：扩展平台与完善界面**
   - 增加 GitHub 适配器，支持拉取通知、Issue 和 PR 信息。
   - 支持新闻、股市等外部信息源；提供用户自定义订阅和抓取频率设置。
   - 完善前端体验：加入主题切换、拖拽排序、快捷键、移动端适配。
   - 实现基本通知推送与同步功能。

3. **阶段 3：智能代理功能**
   - 集成 NLP 模型，提供邮件摘要与回复建议；实现异步处理和缓存。
   - 新增股市分析、GitHub 关注建议等领域智能服务。
   - 提供用户界面配置 AI 模型偏好，例如摘要长度、回复语气等。

4. **阶段 4：优化与商业化**
   - 性能优化：水平扩展抓取服务和 AI 服务；完善容错和恢复策略。
   - 数据隐私与合规审计：完成第三方安全审查、确保符合相关法规。
   - 推出高级订阅功能（例如支持更多账号、专业分析报告等）；与企业账户集成（如 Office 365、Slack、CRM）。
   - 持续收集用户反馈并迭代功能。

## 挑战与风险

1. **发件人匹配困难**：不同邮箱地址可能属于同一联系人，需要算法或人工确认；错误匹配可能导致信息混淆。
2. **第三方 API 限制**：各平台的访问频率限制和数据使用政策不同，需要缓存和优先级策略，避免被封禁。
3. **安全风险**：统一聚合集中存储所有令牌，一旦泄露危害巨大。必须实施严格的密钥管理与安全审计。
4. **用户采纳度**：部分用户出于隐私考虑会分隔不同邮箱，是否愿意使用统一聚合产品需通过市场验证；可提供灵活配置以增强信任。
5. **AI 误差与伦理**：摘要和建议可能出现理解偏差或敏感内容，需要为用户提供原文对照并允许关闭 AI 功能。

## 总结

通过构建多平台信息聚合、按发件人组织界面及智能代理支持，本项目可以显著提升用户处理大量消息的效率，解决多账号邮件管理的痛点。类似 Unibox 等产品的成功经验说明“按发件人聚合”设计能够让邮件体验更自然【719016143334727†L32-L44】；Spark 等客户端也支持此功能以方便用户快速找到重要发件人【354842816371798†L174-L201】。此外，邮件客户端市场正在快速增长，企业与专业用户对集中化、智能化管理的需求日益增加【256115553608614†L810-L848】。在此背景下，本项目具备明确的用户价值和商业潜力。通过合理的系统架构、严格的安全措施和渐进式开发计划，可以降低实现风险，打造一款兼具创新和实用性的统一信息聚合平台。

## 详细实现及目录结构

为了让开发团队或自动化代码生成工具（如 Codex）能够直接根据此方案构建项目，本节提供具体的文件结构、数据库模式和 API 设计示例。这些规范可以根据实际技术栈进行调整，但总体思路应保持一致。

### 目录结构示例

项目采用前后端分离模式，建议的文件树如下（以 Python/FastAPI 和 React 为例）：

```
project-root/
├── backend/
│   ├── app.py                 # FastAPI 应用入口，挂载路由和中间件
│   ├── requirements.txt       # 后端依赖列表
│   ├── config.py              # 配置加载（数据库连接、密钥等）
│   ├── models/                # SQLAlchemy ORM 模型定义
│   │   ├── user.py
│   │   ├── account.py
│   │   ├── message.py
│   │   └── contact.py
│   ├── routers/               # 路由定义，每个模块一个路由
│   │   ├── auth.py
│   │   ├── accounts.py
│   │   ├── contacts.py
│   │   ├── messages.py
│   │   └── agents.py
│   ├── services/              # 业务逻辑，连接器、AI 服务、聚合逻辑
│   │   ├── auth_service.py
│   │   ├── connector_service.py
│   │   ├── aggregation_service.py
│   │   ├── agent_service.py
│   │   └── notification_service.py
│   ├── tasks/                 # 定时任务和异步工作器（Celery 或 RQ）
│   │   ├── fetch_mail.py
│   │   ├── fetch_github.py
│   │   └── generate_summary.py
│   ├── database.py            # 数据库会话和初始化
│   └── Dockerfile             # 后端镜像构建脚本
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── api/               # 封装前端调用的 API
│   │   ├── components/
│   │   │   ├── ContactCard.tsx   # 联系人卡片组件
│   │   │   ├── ConversationPane.tsx # 会话面板
│   │   │   └── NotificationBell.tsx
│   │   ├── hooks/            # React hooks（如 useFetch）
│   │   ├── pages/
│   │   │   └── Dashboard.tsx  # 主面板页面
│   │   └── styles/           # 样式文件
│   └── Dockerfile             # 前端镜像构建脚本
├── docker-compose.yml         # 定义服务（数据库、队列、后端、前端）
└── README.md                  # 项目说明和部署指导
```

上述目录划分将业务逻辑与接口、数据库模型分离，便于维护和自动生成代码。根据不同语言/框架，可调整文件名和结构（例如使用 NestJS 和 TypeORM；或使用 Django 和 DRF）。

### 数据库模式设计

以下是核心表的建议字段，使用 PostgreSQL 实现；字段类型可根据具体 ORM 调整：

1. **users**：保存用户信息。
   | 字段名        | 类型            | 描述                            |
   |--------------|----------------|--------------------------------|
   | id           | UUID (PK)      | 用户唯一标识符                  |
   | email        | VARCHAR        | 主注册邮箱，用于登录            |
   | password_hash| VARCHAR        | 密码哈希（若使用自研认证）     |
   | created_at   | TIMESTAMP      | 创建时间                        |
   | updated_at   | TIMESTAMP      | 更新时间                        |
   | last_login   | TIMESTAMP      | 最近登录时间                    |

2. **connected_accounts**：用户绑定的各个平台账号。
   | 字段名         | 类型            | 描述                                   |
   |---------------|----------------|---------------------------------------|
   | id            | UUID (PK)      | 绑定记录 ID                            |
   | user_id       | UUID (FK)      | 对应用户                              |
   | platform      | VARCHAR        | 平台类型（email、github、stock 等）  |
   | identifier    | VARCHAR        | 平台唯一标识（如邮箱地址或 GitHub 用户名） |
   | access_token  | TEXT           | OAuth/IMAP 访问令牌（加密存储）        |
   | refresh_token | TEXT           | 刷新令牌（如需）                      |
   | status        | VARCHAR        | 状态（active、revoked、expired）       |
   | created_at    | TIMESTAMP      | 创建时间                              |
   | updated_at    | TIMESTAMP      | 更新时间                              |

3. **contacts**：系统根据发件人聚合出的联系人。
   | 字段名         | 类型            | 描述                                             |
   |---------------|----------------|-------------------------------------------------|
   | id            | UUID (PK)      | 联系人 ID                                        |
   | user_id       | UUID (FK)      | 所属用户                                        |
   | display_name  | VARCHAR        | 显示名称（首选昵称或姓名）                       |
   | avatar_url    | VARCHAR        | 头像 URL                                        |
   | source_tags   | JSONB          | 来源列表（例如：["gmail","github"]）             |
   | merged_from   | JSONB          | 合并的邮箱地址/账号列表                          |
   | created_at    | TIMESTAMP      | 创建时间                                        |
   | updated_at    | TIMESTAMP      | 更新时间                                        |

4. **messages**：保存邮件、通知和其他信息。
   | 字段名         | 类型            | 描述                                                 |
   |---------------|----------------|-----------------------------------------------------|
   | id            | UUID (PK)      | 消息 ID                                             |
   | contact_id    | UUID (FK)      | 所属联系人                                           |
   | account_id    | UUID (FK)      | 原始绑定账号                                         |
   | platform      | VARCHAR        | 来源平台（email、github 等）                        |
   | sender        | VARCHAR        | 发件人地址或用户名                                   |
   | subject       | VARCHAR        | 标题或主题                                           |
   | body          | TEXT           | 消息正文（可存储纯文本或 HTML）                      |
   | summary       | TEXT           | AI 生成的摘要（可为空，异步生成后填充）              |
   | received_at   | TIMESTAMP      | 接收时间                                             |
   | processed_at  | TIMESTAMP      | 抓取并存储时间                                       |
   | is_unread     | BOOLEAN        | 是否未读                                             |
   | is_archived   | BOOLEAN        | 是否已归档                                           |
   | reply_to      | VARCHAR        | 用于回复的 Thread-Id 或 Message-Id                  |

5. **message_status**：记录 AI 处理状态及错误（可选）。
   | 字段名         | 类型            | 描述                                                   |
   |---------------|----------------|-------------------------------------------------------|
   | id            | UUID (PK)      | 状态记录 ID                                            |
   | message_id    | UUID (FK)      | 对应的消息                                             |
   | status        | VARCHAR        | current, summarizing, done, error 等                    |
   | error_message | TEXT           | 错误信息（若发生异常）                                |
   | updated_at    | TIMESTAMP      | 更新时间                                               |

数据库设计可根据实际业务扩展，例如支持附件表、通知偏好表等。使用 ORM（如 SQLAlchemy、TypeORM）可简化操作。

### REST API 设计示例

下表给出核心接口，以 REST 风格为例（路径基于 `/api/v1` 前缀）。实际实现时可使用 GraphQL 或 RPC 格式，但需要保持接口语义清晰。

| 方法  | 路径                                | 描述                                                     |
|------|------------------------------------|---------------------------------------------------------|
| POST | `/auth/register`                   | 用户注册，传入邮箱、密码，返回 JWT                      |
| POST | `/auth/login`                      | 用户登录，传入邮箱、密码，返回 JWT                      |
| POST | `/accounts`                        | 绑定第三方账号，参数包括平台类型、OAuth code 等           |
| GET  | `/accounts`                        | 获取用户已绑定的账号列表                                 |
| DELETE| `/accounts/{account_id}`         | 取消绑定指定账号                                         |
| GET  | `/contacts`                        | 获取联系人列表，可传入分页参数、搜索关键词                |
| GET  | `/contacts/{contact_id}`           | 获取单个联系人详细信息及最近消息                          |
| GET  | `/contacts/{contact_id}/messages`  | 获取该联系人的消息列表，支持分页、筛选（按时间、关键词）    |
| POST | `/contacts/{contact_id}/reply`     | 发送回复邮件/消息，body 包含内容、附件、使用账号          |
| POST | `/messages/{message_id}/archive`    | 将消息标记为归档                                          |
| POST | `/messages/{message_id}/mark-read`  | 标记消息为已读                                            |
| GET  | `/agents/summary/{message_id}`      | 获取指定消息的摘要，如未生成则触发生成                    |
| POST | `/agents/reply-suggest`            | 提交消息内容和上下文，返回生成的回复建议                 |
| GET  | `/notifications`                   | 拉取用户通知中心消息                                      |

接口应接受并返回 JSON 格式的数据；每个请求通过 Authorization header 携带 JWT。对于文件上传（如附件），使用 `multipart/form-data`。

### 连接器实现思路

以下是邮件和 GitHub 连接器的伪代码示例，以 Python 为例说明如何编写异步抓取任务：

```python
# tasks/fetch_mail.py
from imaplib import IMAP4_SSL
from email.parser import BytesParser
from datetime import datetime
from database import db_session
from models import ConnectedAccount, Message

def fetch_unseen_emails(account: ConnectedAccount):
    # 使用 OAuth2 令牌登录 IMAP
    with IMAP4_SSL(account.imap_server) as imap:
        imap.authenticate("XOAUTH2", lambda x: f"user={account.identifier}\1auth=Bearer {account.access_token}\1\1")
        imap.select("INBOX")
        typ, data = imap.search(None, 'UNSEEN')
        for num in data[0].split():
            typ, msg_data = imap.fetch(num, '(RFC822)')
            msg = BytesParser().parsebytes(msg_data[0][1])
            sender = msg["From"]
            subject = msg["Subject"]
            body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')
            # 保存或更新联系人与消息
            # ... 创建/更新 Contact
            # ... 写入 Message 表
            db_session.add(Message(...))
        db_session.commit()

```

```python
# tasks/fetch_github.py
from github import Github
from database import db_session
from models import ConnectedAccount, Message

def fetch_github_notifications(account: ConnectedAccount):
    g = Github(account.access_token)
    for n in g.get_user().get_notifications():
        # 提取通知信息
        sender = n.repository.owner.login
        subject = n.subject.title
        body = n.subject.url  # 可进一步调用 API 获取更多详情
        received_at = n.updated_at
        # 保存消息
        db_session.add(Message(...))
    db_session.commit()

```

上述代码示例展示了如何使用 IMAP 和 GitHub API 拉取新消息，将其转换为统一的消息对象并存储。实际项目中需处理错误重试、令牌过期刷新、分页抓取等情况。此外，还需要根据平台具体字段填充联系人和消息属性。

### 后端服务启动与调度

1. **任务调度**：使用 Celery 或 RQ 等任务队列编写后台 worker，定时调用 `fetch_unseen_emails`、`fetch_github_notifications` 等任务。任务调度可放在 `tasks/scheduler.py` 中，使用 `Celery beat` 或 APScheduler 定义不同平台的抓取频率。
2. **API 启动**：在 `app.py` 中创建 FastAPI 实例，包含路由和中间件；使用 Uvicorn 或 Gunicorn 启动。
3. **消息推送**：部署 WebSocket 服务器或使用第三方推送服务；当任务写入新消息或生成摘要后，推送给前端。
4. **环境配置**：使用 `.env` 文件管理数据库连接、第三方 API 密钥等；Dockerfile 中复制依赖并暴露端口。`docker-compose.yml` 中定义 Postgres、Redis、RabbitMQ、backend、frontend 服务，方便本地部署。

### 前端调用示例

前端通过封装 API 请求获取联系人和消息，并在页面中展示卡片。以下是基于 React + Axios 的简要示例：

```tsx
// api/contacts.ts
import axios from 'axios';
export async function fetchContacts(page = 1) {
  const resp = await axios.get('/api/v1/contacts', { params: { page } });
  return resp.data.contacts;
}

// components/ContactCard.tsx
interface Contact {
  id: string;
  display_name: string;
  avatar_url: string;
  source_tags: string[];
  latest_message: string;
  unread_count: number;
}
export function ContactCard({ contact }: { contact: Contact }) {
  return (
    <div className="contact-card">
      <img src={contact.avatar_url} alt={contact.display_name} />
      <div>
        <h3>{contact.display_name}</h3>
        <p>{contact.latest_message}</p>
      </div>
      {contact.unread_count > 0 && <span className="badge">{contact.unread_count}</span>}
      {/* 加入平台图标列表 */}
    </div>
  );
}

// pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { fetchContacts } from '../api/contacts';
import { ContactCard } from '../components/ContactCard';

export default function Dashboard() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  useEffect(() => {
    fetchContacts().then((data) => setContacts(data));
  }, []);
  return (
    <div className="dashboard">
      {contacts.map((c) => (
        <ContactCard key={c.id} contact={c} />
      ))}
    </div>
  );
}

```

前端组件负责渲染联系人卡片和会话面板，通过 API 与后端通信。当用户点击某个联系人卡片时，可以调用 `/contacts/{contact_id}/messages` 获取详细信息并渲染在 `ConversationPane` 组件中。对于消息回复，可调用 `/contacts/{contact_id}/reply` 接口发送邮件。利用全局状态管理（如 Redux）跟踪未读数和通知。

以上详细实现和目录结构为 Codex 等工具提供了明确的蓝图，帮助其自动生成对应的代码文件和模块。在实际开发时，可根据团队习惯或框架特性灵活调整，但尽量保持模块的职责划分清晰，便于扩展和维护。


import httpx

TOKEN = "你的Bearer Token"
USERNAME = "你订阅的用户名"

# 测试获取用户信息
r = httpx.get(
   f"https://api.x.com/2/users/by/username/{USERNAME}",
   headers={"Authorization": f"Bearer {TOKEN}"},
   params={"user.fields": "id,name,username"}
)
print(r.status_code, r.json())