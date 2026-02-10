# MercuryDesk 当前架构快照

更新时间: 2026-02-11

## 表 1: 当前爬取信息机制

| 模块 | 现状机制 | 并发策略 | 失败兜底 |
|---|---|---|---|
| 同步任务调度 | `backend/app/services/sync_jobs.py` 使用线程池执行账户同步任务 | 全局 `sync_job_max_workers=12`（`backend/app/settings.py`） | 作业状态可轮询，失败记录错误 |
| 多账号“同步全部” | 前端 Dashboard 并发触发多账号同步 | 默认并发 `12`（可由 `VITE_DASHBOARD_SYNC_CONCURRENCY` 覆盖） | 单账号失败不阻断其他账号 |
| 通用 Feed 类源（RSS/X/B站等） | 走各 Connector + URL 规范化 + 入库去重 | 账号级并行 + 源内策略并行 | 重试与多入口 URL |
| 抖音抓取 | 优先 Playwright（登录态持久化浏览器上下文）抓取；失败后 RSSHub | RSSHub 镜像并行探测，`crawler_rsshub_parallelism=12` | Playwright 失败自动退 RSSHub，多镜像并发兜底 |
| 小红书抓取 | 优先 Playwright；再尝试 RSSHub / 页面提取链路 | RSSHub 镜像并行（同上） | 多策略回退（浏览器/API/页面） |
| 数据入库与去重 | 以 `(user_id, source, external_id)` 去重，联系人聚合更新 | 入库在每账户任务内串行提交 | 幂等: 重复拉取不重复写入 |
| 摘要生成 | 同步流程可生成消息摘要（LLM 或规则摘要） | 不作为高并发核心瓶颈 | LLM 不可用时规则摘要兜底 |

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
