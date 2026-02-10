# MercuryDesk 当前架构快照

更新时间: 2026-02-11

## 表 1: 全平台爬取/采集机制（按 provider）

| 平台/Provider   | Connector                      | 主策略                                     | 回退策略                                                                | 认证与关键依赖                                    | 并发与调度特征                                     |
| ------------- | ------------------------------ | --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------- |
| `mock`        | `MockConnector`                | 本地模拟消息生成                                | 无                                                                   | 无外部依赖                                      | 由同步任务线程池调度                                  |
| `forward`     | `_NoopConnector`（同步时）          | 不主动拉取；通过 `/inbound/forward` 被动接收        | 无                                                                   | 依赖 inbound secret 路由鉴权                     | 无抓取并发，仅入站写库                                 |
| `github`      | `GitHubNotificationsConnector` | GitHub REST `/notifications` 拉取通知       | 无显式二级回退                                                             | OAuth/Token（`Authorization: Bearer`）       | 由账号级同步并发驱动                                  |
| `gmail`       | `GmailConnector`               | Gmail API 列表 + 按 message id 拉详情         | Token 失效时尝试 refresh token                                           | OAuth access token（可刷新）                    | 由账号级同步并发驱动                                  |
| `outlook`     | `OutlookConnector`             | Microsoft Graph 邮件拉取                    | Token 失效时尝试 refresh token                                           | OAuth access token（可刷新）                    | 由账号级同步并发驱动                                  |
| `imap`        | `ImapConnector`                | IMAP 协议登录邮箱后搜索/抓取邮件                     | 错误人类可读化提示（账号/SSL/网络）                                                | 主机端口+用户名+授权码/密码                            | 由账号级同步并发驱动                                  |
| `rss`         | `FeedConnector`                | 标准 RSS/Atom 解析（`feedparser`）            | URL 规范化后重试链路                                                        | 无统一鉴权，取决于 feed 源                           | 由账号级同步并发驱动                                  |
| `x`           | `XConnector`                   | 官方 API（Bearer）优先                        | GraphQL Cookie 认证 -> GraphQL Guest -> RSSHub -> 自定义 fallback feed   | Bearer token / `auth_token+ct0` / 访客 token | 单账号内多策略串联，账号级并发                             |
| `bilibili`    | `BilibiliConnector`            | `recArchivesByKeywords` API（主）          | WBI API -> jina.ai + API详情 -> RSSHub -> Playwright -> fallback feed | 无头 API 为主；Playwright 为最后手段                 | 单账号内多策略串联，账号级并发                             |
| `douyin`      | `DouyinConnector`              | Playwright 精简模式（直达用户页+XHR/SSR）          | Playwright fresh context -> RSSHub 多镜像并发探测                          | Playwright 环境；可结合自建 RSSHub/cookie          | RSSHub 镜像并发，`crawler_rsshub_parallelism=12` |
| `xiaohongshu` | `XiaohongshuConnector`         | Playwright 精简模式（提取 `__INITIAL_STATE__`） | Playwright fresh context -> jina.ai -> RSSHub 并发 -> fallback feed   | Playwright / jina.ai / 可选 RSSHub           | RSSHub 镜像并发，`crawler_rsshub_parallelism=12` |
| `weibo`       | `WeiboConnector`               | m.weibo.cn API 抓取用户时间线                  | RSSHub 镜像 -> fallback feed                                          | 无统一 token；依赖公开接口可用性                        | 账号级并发；RSSHub 为回退                            |

补充（全局并发控制）:
- 同步任务线程池: `backend/app/settings.py` `sync_job_max_workers=12`
- RSSHub 镜像并发: `backend/app/settings.py` `crawler_rsshub_parallelism=12`
- 前端“同步全部”默认并发: `frontend/src/components/Dashboard.tsx` 默认 `12`（可被 `VITE_DASHBOARD_SYNC_CONCURRENCY` 覆盖）

## 表 2: 当前完备 Chat Agent 架构

| 层级 | 组件/文件 | 当前能力 | 说明 |
|---|---|---|---|
| API 入口层 | `backend/app/routers/agent.py` | `/agent/chat`、`/agent/memory`、`/agent/memory/notes` | Chat、记忆快照、增删笔记接口 |
| 协议层 | `backend/app/schemas.py` | `AgentChatRequest` 新增 `tools`、`use_memory` | 支持每条消息工具白名单与记忆开关 |
| LLM 编排层 | `backend/app/services/llm.py` | 多轮工具编排（3 轮 × 每轮 6 次） | 非单轮 tool-call；可处理更复杂任务链 |
| 工具执行层 | `backend/app/services/agent_tools.py` | `search_messages`、`get_contact_info` + allowlist 过滤 | 工具可按消息动态授权 |
| 记忆核心层 | `backend/app/services/agent_memory.py` | 短期摘要、长期 notes、焦点内容提取 | 焦点内容来自近期消息的“关注信息/帖子”评分 |
| 记忆数据层 | `backend/app/models.py` | `AgentConversationMemory`、`AgentMemoryNote` | 持久化会话摘要与用户偏好记忆 |
| Prompt 组装层 | `backend/app/routers/agent.py` | 系统提示 + 联系人上下文 + 记忆注入 | 记忆以系统上下文注入，提高连贯性 |
| 前端交互层 | `frontend/src/components/AgentChatPanel.tsx` | 工具选择、记忆开关、记忆卡片展示 | 直接可见“最近关注信息/帖子” |
| 前端 API 层 | `frontend/src/api.ts` | chat options、memory 获取/增删 | 前后端协议已联通 |
| 测试层 | `backend/tests/test_agent_memory.py` | 覆盖记忆接口与基本链路 | 后端测试已通过 |
