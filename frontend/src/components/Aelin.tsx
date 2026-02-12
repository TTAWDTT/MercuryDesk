import React from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Badge from "@mui/material/Badge";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputBase from "@mui/material/InputBase";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import Dialog from "@mui/material/Dialog";
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SendIcon from "@mui/icons-material/Send";
import SettingsIcon from "@mui/icons-material/Settings";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ImageIcon from "@mui/icons-material/Image";
import CloseIcon from "@mui/icons-material/Close";
import TimelineIcon from "@mui/icons-material/Timeline";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import BoltIcon from "@mui/icons-material/Bolt";
import RefreshIcon from "@mui/icons-material/Refresh";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import InsightsIcon from "@mui/icons-material/Insights";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import { alpha, useTheme } from "@mui/material/styles";
import {
  AelinAction,
  AelinCitation,
  AelinContextResponse,
  AelinImageInput,
  AelinTrackingItem,
  AelinToolStep,
  MessageDetail,
  aelinChat,
  aelinConfirmTrack,
  getAelinTracking,
  getAelinContext,
  getMessage,
} from "../api";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useToast } from "../contexts/ToastContext";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  pending?: boolean;
  citations?: AelinCitation[];
  actions?: AelinAction[];
  images?: AelinImageInput[];
  tool_trace?: AelinToolStep[];
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updated_at: number;
};

type PendingImage = {
  id: string;
  dataUrl: string;
  name: string;
};

type TrackingSheetState = {
  action: AelinAction;
  messageId: string;
};

type HandoffFXState = {
  title: string;
  detail: string;
};

export type AelinDeskBridgePayload = {
  sessionId: string;
  workspace: string;
  messageId?: number;
  contactId?: number;
  focusQuery?: string;
  highlightSource?: string;
  resumePrompt?: string;
};

type AelinProps = {
  embedded?: boolean;
  workspace?: string;
  onOpenDesk?: (payload: AelinDeskBridgePayload) => void;
  onRequestClose?: () => void;
};

type ResultCard = {
  id: string;
  title: string;
  value: string;
  subtitle?: string;
  accent: string;
  icon: React.ReactNode;
};

type SlashCommandDef = {
  key: "/compare" | "/track" | "/digest" | "/debate";
  label: string;
  template: string;
  helper: string;
};

const QUICK_PROMPTS = [
  "今天最值得我看的5条更新是什么？",
  "帮我梳理最近7天这个话题的变化。",
  "我现在最该优先关注什么？",
  "给我一个20分钟的信息阅读计划。",
];

const SLASH_COMMANDS: SlashCommandDef[] = [
  { key: "/compare", label: "Compare", template: "/compare A vs B", helper: "比较两个对象的近期动态与差异" },
  { key: "/track", label: "Track", template: "/track 主题名", helper: "回答后建议/开启持续跟踪" },
  { key: "/digest", label: "Digest", template: "/digest 主题名", helper: "产出最近24小时重点简报" },
  { key: "/debate", label: "Debate", template: "/debate 观点", helper: "从正反两面进行论证" },
];

const AELIN_CHAT_STORAGE_KEY = "aelin:chat:v1";
const AELIN_SESSIONS_STORAGE_KEY = "aelin:sessions:v1";
const AELIN_LAST_SESSION_KEY = "aelin:last-session-id:v1";
const AELIN_LAST_DESK_BRIDGE_KEY = "aelin:last-desk-bridge:v1";
const MAX_PERSISTED_MESSAGES = 180;
const MAX_PERSISTED_IMAGE_DATA_URL = 320_000;
const MAX_PERSISTED_SESSIONS = 20;

type PlatformKey =
  | "bilibili"
  | "douyin"
  | "xiaohongshu"
  | "weibo"
  | "x"
  | "github"
  | "rss"
  | "web"
  | "email"
  | "generic";

const PLATFORM_META: Record<PlatformKey, { label: string; color: string; bg: string; border: string }> = {
  bilibili: { label: "Bilibili", color: "#00A1D6", bg: "rgba(0,161,214,0.14)", border: "rgba(0,161,214,0.38)" },
  douyin: { label: "抖音", color: "#12D6CC", bg: "rgba(18,214,204,0.14)", border: "rgba(18,214,204,0.36)" },
  xiaohongshu: { label: "小红书", color: "#FF2442", bg: "rgba(255,36,66,0.12)", border: "rgba(255,36,66,0.36)" },
  weibo: { label: "微博", color: "#E6162D", bg: "rgba(230,22,45,0.11)", border: "rgba(230,22,45,0.32)" },
  x: { label: "X", color: "#121212", bg: "rgba(18,18,18,0.10)", border: "rgba(18,18,18,0.28)" },
  github: { label: "GitHub", color: "#24292E", bg: "rgba(36,41,46,0.10)", border: "rgba(36,41,46,0.28)" },
  rss: { label: "RSS", color: "#F26522", bg: "rgba(242,101,34,0.11)", border: "rgba(242,101,34,0.33)" },
  web: { label: "Web", color: "#2563EB", bg: "rgba(37,99,235,0.11)", border: "rgba(37,99,235,0.34)" },
  email: { label: "Email", color: "#6A9BCC", bg: "rgba(106,155,204,0.13)", border: "rgba(106,155,204,0.35)" },
  generic: { label: "Source", color: "#7A786F", bg: "rgba(122,120,111,0.11)", border: "rgba(122,120,111,0.26)" },
};

const PLATFORM_ALIASES: Record<string, PlatformKey> = {
  bilibili: "bilibili",
  b站: "bilibili",
  bili: "bilibili",
  douyin: "douyin",
  抖音: "douyin",
  xiaohongshu: "xiaohongshu",
  小红书: "xiaohongshu",
  xhs: "xiaohongshu",
  weibo: "weibo",
  微博: "weibo",
  x: "x",
  twitter: "x",
  推特: "x",
  web: "web",
  搜索: "web",
  github: "github",
  rss: "rss",
  imap: "email",
  email: "email",
  邮箱: "email",
  邮件: "email",
};

const TRACKING_SOURCE_LABEL: Record<string, string> = {
  auto: "自动",
  web: "Web",
  rss: "RSS",
  x: "X",
  douyin: "抖音",
  xiaohongshu: "小红书",
  weibo: "微博",
  bilibili: "Bilibili",
  email: "邮箱",
};

const TRACKING_STATUS_META: Record<string, { label: string; color: "success" | "info" | "warning" | "error" | "default" }> = {
  active: { label: "进行中", color: "success" },
  created: { label: "已创建", color: "info" },
  seeded: { label: "已预热", color: "info" },
  sync_started: { label: "同步中", color: "success" },
  tracking_enabled: { label: "已启用", color: "success" },
  needs_config: { label: "需配置", color: "warning" },
  failed: { label: "失败", color: "error" },
};

function normalizePlatformName(raw: string): PlatformKey | null {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, "");
  if (!key) return null;
  return PLATFORM_ALIASES[key] || null;
}

function formatTrackingStatus(raw: string): { label: string; color: "success" | "info" | "warning" | "error" | "default" } {
  const key = (raw || "").trim().toLowerCase();
  return TRACKING_STATUS_META[key] || { label: raw || "未知", color: "default" };
}

function normalizeAccountKey(raw: string): string {
  return raw.replace(/^@+/, "").trim().toLowerCase();
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initialsFromName(name: string): string {
  const normalized = name.replace(/^@+/, "").trim();
  if (!normalized) return "?";
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  return (normalized[0] || "?").toUpperCase();
}

function resolveCitationPlatform(item: AelinCitation): PlatformKey {
  const bySource = normalizePlatformName(item.source || "");
  if (bySource) return bySource;
  const byLabel = normalizePlatformName(item.source_label || "");
  if (byLabel) return byLabel;
  return "generic";
}

function nextMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function formatIsoTime(raw: string | null | undefined) {
  if (!raw) return "未知时间";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString([], {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initialMessages(): ChatMessage[] {
  return [
    {
      id: nextMessageId(),
      role: "assistant",
      content: "我是 Aelin。告诉我你想追踪什么，我会基于你的长期信号来回答。",
      ts: Date.now(),
    },
  ];
}

function deriveSessionTitle(messages: ChatMessage[]): string {
  const user = messages.find((item) => item.role === "user" && item.content.trim());
  if (!user) return "新对话";
  const first = user.content.trim().split("\n")[0] || "新对话";
  return first.length > 22 ? `${first.slice(0, 22)}…` : first;
}

function newSession(messages?: ChatMessage[]): ChatSession {
  const payload = messages && messages.length ? messages : initialMessages();
  return {
    id: nextMessageId(),
    title: deriveSessionTitle(payload),
    messages: payload,
    updated_at: Date.now(),
  };
}

function loadPersistedMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AELIN_CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { messages?: unknown } | unknown;
    const list =
      parsed && typeof parsed === "object" && "messages" in parsed
        ? (parsed as { messages?: unknown }).messages
        : parsed;
    if (!Array.isArray(list)) return [];
    const restored: ChatMessage[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const rawMessage = item as Partial<ChatMessage>;
      if (rawMessage.role !== "user" && rawMessage.role !== "assistant") continue;
      if (typeof rawMessage.content !== "string") continue;
      if (typeof rawMessage.ts !== "number" || Number.isNaN(rawMessage.ts)) continue;
      const images = Array.isArray(rawMessage.images)
        ? rawMessage.images
            .filter((img) => !!img && typeof img === "object" && typeof img.data_url === "string")
            .slice(0, 4)
            .map((img) => ({ data_url: img.data_url, name: img.name }))
        : undefined;
      const toolTrace = Array.isArray(rawMessage.tool_trace)
        ? rawMessage.tool_trace
            .filter((step) => !!step && typeof step === "object" && typeof (step as AelinToolStep).stage === "string")
            .map((step) => normalizeTraceStep(step as AelinToolStep))
            .slice(0, 8)
        : undefined;
      restored.push({
        id: typeof rawMessage.id === "string" && rawMessage.id ? rawMessage.id : nextMessageId(),
        role: rawMessage.role,
        content: rawMessage.content,
        ts: rawMessage.ts,
        citations: Array.isArray(rawMessage.citations) ? rawMessage.citations : undefined,
        actions: Array.isArray(rawMessage.actions) ? rawMessage.actions : undefined,
        images,
        tool_trace: toolTrace,
      });
    }
    return restored.slice(-MAX_PERSISTED_MESSAGES);
  } catch {
    return [];
  }
}

function toPersistedMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages
    .filter((item) => !item.pending)
    .slice(-MAX_PERSISTED_MESSAGES)
    .map((item) => {
      const images = Array.isArray(item.images)
        ? item.images
            .filter((img) => img.data_url.length <= MAX_PERSISTED_IMAGE_DATA_URL)
            .slice(0, 4)
            .map((img) => ({ data_url: img.data_url, name: img.name }))
        : undefined;
      return {
        id: item.id,
        role: item.role,
        content: item.content,
        ts: item.ts,
        citations: item.citations,
        actions: item.actions,
        images,
        tool_trace: item.tool_trace,
      };
    });
}

function normalizeTraceStep(step: AelinToolStep): AelinToolStep {
  return {
    stage: (step.stage || "stage").toLowerCase(),
    status: (step.status || "completed").toLowerCase(),
    detail: step.detail || "",
    count: Number(step.count || 0),
  };
}

function toolStepLabel(stage: string): string {
  const map: Record<string, string> = {
    planner: "规划",
    local_search: "本地检索",
    web_search: "联网搜索",
    generation: "生成回答",
  };
  return map[stage] || stage;
}

function parseScoreCards(text: string): ResultCard[] {
  const rows: ResultCard[] = [];
  const seen = new Set<string>();
  const regex = /([A-Za-z\u4e00-\u9fff·]{1,24})?\s*(\d{2,3})\s*[-:：]\s*(\d{2,3})\s*([A-Za-z\u4e00-\u9fff·]{1,24})?/g;
  let m: RegExpExecArray | null = null;
  while ((m = regex.exec(text)) !== null) {
    const left = (m[1] || "队伍A").trim();
    const right = (m[4] || "队伍B").trim();
    const a = Number(m[2]);
    const b = Number(m[3]);
    if (Number.isNaN(a) || Number.isNaN(b) || a < 40 || b < 40 || a > 200 || b > 200) continue;
    const id = `${left}-${a}-${b}-${right}`.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({
      id,
      title: `${left} vs ${right}`,
      value: `${a} : ${b}`,
      subtitle: a > b ? `${left} 暂时领先` : b > a ? `${right} 暂时领先` : "比分接近",
      accent: a > b ? "#e07a5f" : "#3f88c5",
      icon: <InsightsIcon sx={{ fontSize: 16 }} />,
    });
    if (rows.length >= 3) break;
  }
  return rows;
}

function cardsFromMessage(message: ChatMessage): ResultCard[] {
  const cards: ResultCard[] = [];
  cards.push(...parseScoreCards(message.content || ""));
  for (const c of message.citations || []) {
    if (cards.length >= 6) break;
    cards.push({
      id: `cite-${message.id}-${c.message_id}-${c.source}`,
      title: c.source_label || c.source,
      value: c.title || "证据",
      subtitle: `${c.sender || "unknown"} · ${c.received_at.slice(5)}`,
      accent: "#4d6fff",
      icon: <TravelExploreIcon sx={{ fontSize: 16 }} />,
    });
  }
  return cards;
}

function transformSlashCommand(raw: string): string {
  const text = raw.trim();
  if (!text.startsWith("/")) return text;
  const [cmd, ...rest] = text.split(/\s+/);
  const arg = rest.join(" ").trim();
  if (cmd === "/track") return `请先回答我的问题，并判断是否应持续跟踪主题：${arg || "（未指定）"}。`;
  if (cmd === "/digest") return `请基于最近24小时信号，输出结构化简报：${arg || "今日重点"}。`;
  if (cmd === "/debate") return `请围绕这个观点做正反辩论并给结论：${arg || "（未指定）"}。`;
  if (cmd === "/compare") return `请比较以下对象最近动态并给差异总结：${arg || "A vs B"}。`;
  return text;
}

function matchingSlashCommands(input: string): SlashCommandDef[] {
  const t = input.trim().toLowerCase();
  if (!t.startsWith("/")) return [];
  return SLASH_COMMANDS.filter((it) => it.key.startsWith(t as SlashCommandDef["key"]));
}

function buildStoryFromContext(ctx: AelinContextResponse | null): string {
  if (!ctx) return "当前没有足够数据来生成故事模式。先同步一些信号后再试。";
  const now = Date.now();
  const in24h = (ctx.focus_items || []).filter((item) => {
    const ts = Date.parse((item.received_at || "").replace(" ", "T"));
    if (Number.isNaN(ts)) return true;
    return now - ts <= 24 * 60 * 60 * 1000;
  });
  const top = (in24h.length ? in24h : ctx.focus_items || []).slice(0, 6);
  if (!top.length) return "最近24小时没有足够信号，暂时无法生成故事模式。";
  const part1 = top.slice(0, 2).map((x) => `- ${x.title}（${x.source_label}）`).join("\n");
  const part2 = top.slice(2, 4).map((x) => `- ${x.title}（${x.sender}）`).join("\n");
  const part3 = top.slice(4, 6).map((x) => `- ${x.title}`).join("\n");
  return [
    "### 24h 故事模式",
    "第一幕：发生了什么",
    part1 || "- 暂无",
    "",
    "第二幕：为什么值得关注",
    part2 || "- 暂无",
    "",
    "第三幕：接下来你可以做什么",
    part3 || "- 建议继续观察",
  ].join("\n");
}

function loadPersistedSessions(): { sessions: ChatSession[]; activeId: string } {
  if (typeof window === "undefined") {
    const session = newSession();
    return { sessions: [session], activeId: session.id };
  }
  try {
    const raw = window.localStorage.getItem(AELIN_SESSIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { sessions?: unknown; active_id?: unknown };
      const sessionRows = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      const sessions: ChatSession[] = [];
      for (const row of sessionRows) {
        if (!row || typeof row !== "object") continue;
        const r = row as Partial<ChatSession>;
        const restoredMsgs = Array.isArray(r.messages) ? toPersistedMessages(r.messages as ChatMessage[]) : [];
        if (!restoredMsgs.length) continue;
        sessions.push({
          id: typeof r.id === "string" && r.id ? r.id : nextMessageId(),
          title: typeof r.title === "string" && r.title.trim() ? r.title.trim().slice(0, 80) : deriveSessionTitle(restoredMsgs),
          messages: restoredMsgs,
          updated_at: typeof r.updated_at === "number" && !Number.isNaN(r.updated_at) ? r.updated_at : Date.now(),
        });
      }
      if (sessions.length) {
        sessions.sort((a, b) => b.updated_at - a.updated_at);
        const activeCandidate = typeof parsed.active_id === "string" ? parsed.active_id : "";
        const activeId = sessions.some((it) => it.id === activeCandidate) ? activeCandidate : sessions[0].id;
        return { sessions: sessions.slice(0, MAX_PERSISTED_SESSIONS), activeId };
      }
    }
  } catch {
    // ignore and fallback
  }

  const migrated = loadPersistedMessages();
  const session = newSession(migrated.length ? migrated : initialMessages());
  return { sessions: [session], activeId: session.id };
}

function useGroupedMessages(messages: ChatMessage[]) {
  return React.useMemo(() => {
    let lastRole: ChatMessage["role"] | null = null;
    let lastTs = 0;
    return messages.map((message) => {
      const isGroupStart = lastRole !== message.role || message.ts - lastTs > 2 * 60 * 1000;
      lastRole = message.role;
      lastTs = message.ts;
      return { message, isGroupStart };
    });
  }, [messages]);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

const TypingDots = React.memo(function TypingDots() {
  return (
    <Box
      sx={{
        display: "inline-flex",
        gap: 0.5,
        "@keyframes aelinTypingDot": {
          "0%, 70%, 100%": { opacity: 0.3, transform: "translateY(0)" },
          "35%": { opacity: 1, transform: "translateY(-4px)" },
        },
      }}
    >
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "text.secondary", animation: "aelinTypingDot 1.2s infinite ease-in-out" }} />
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "text.secondary", animation: "aelinTypingDot 1.2s 0.14s infinite ease-in-out" }} />
      <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "text.secondary", animation: "aelinTypingDot 1.2s 0.28s infinite ease-in-out" }} />
    </Box>
  );
});

const AccountAvatar = React.memo(function AccountAvatar({
  name,
  src,
  size = 16,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const safeName = name || "unknown";
  const initial = initialsFromName(safeName);
  const hue = hashString(safeName) % 360;
  return (
    <Avatar
      src={src || undefined}
      alt={safeName}
      sx={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.floor(size * 0.5)),
        fontWeight: 700,
        border: "1px solid rgba(255,255,255,0.72)",
        background: src
          ? "transparent"
          : `linear-gradient(135deg, hsla(${hue},78%,58%,0.96), hsla(${(hue + 36) % 360},76%,47%,0.94))`,
        color: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      }}
    >
      {!src ? initial : null}
    </Avatar>
  );
});

const InlineSourceBadge = React.memo(function InlineSourceBadge({
  platform,
  account,
  avatarSrc,
}: {
  platform: PlatformKey;
  account?: string;
  avatarSrc?: string;
}) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.generic;
  const accountLabel = (account || "").trim();
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.42,
        px: 0.72,
        py: 0.2,
        mx: 0.24,
        borderRadius: 999,
        border: "1px solid",
        borderColor: meta.border,
        bgcolor: meta.bg,
        color: meta.color,
        verticalAlign: "middle",
        fontSize: "0.78em",
        fontWeight: 700,
        lineHeight: 1.2,
        transition: "transform 160ms ease, box-shadow 180ms ease",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: `0 6px 14px ${alpha(meta.color, 0.2)}`,
        },
      }}
    >
      <PlatformGlyph platform={platform} size={13} />
      {accountLabel ? <AccountAvatar name={accountLabel} src={avatarSrc} size={15} /> : null}
      <span>{accountLabel || meta.label}</span>
    </Box>
  );
});

const PlatformGlyph = React.memo(function PlatformGlyph({ platform, size = 14 }: { platform: PlatformKey; size?: number }) {
  const meta = PLATFORM_META[platform] || PLATFORM_META.generic;
  if (platform === "bilibili") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4.2" y="6.7" width="15.6" height="12.2" rx="3" stroke={meta.color} strokeWidth="1.7" />
        <path d="M8.4 4.6L10.4 6.7M15.6 4.6L13.6 6.7" stroke={meta.color} strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9.3 11.4h0.01M14.7 11.4h0.01" stroke={meta.color} strokeWidth="2.3" strokeLinecap="round" />
      </svg>
    );
  }
  if (platform === "douyin") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 5.5v8.2a3.8 3.8 0 11-2.2-3.4V6.8c1.9.2 3.4-.2 4.8-1.3" stroke={meta.color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (platform === "xiaohongshu") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="5" stroke={meta.color} strokeWidth="1.6" />
        <path d="M7.4 15.2l3-3 2.6 2.6 3.5-3.6" stroke={meta.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (platform === "weibo") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11.3" cy="13.1" r="4.5" stroke={meta.color} strokeWidth="1.7" />
        <path d="M16.6 7.6c1.4.4 2.6 1.4 3.2 2.8M15 5.4c2.3.3 4.4 1.9 5.3 4" stroke={meta.color} strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="10.2" cy="12.7" r="0.8" fill={meta.color} />
      </svg>
    );
  }
  if (platform === "x") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 5l14 14M18.6 5.3L5.4 18.7" stroke={meta.color} strokeWidth="2.1" strokeLinecap="round" />
      </svg>
    );
  }
  if (platform === "github") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 4.5a7.6 7.6 0 00-2.4 14.9v-2.7c-1.6.4-2.3-.7-2.5-1.3-.2-.5-.7-1.3-1.2-1.6-.4-.2-1-.8 0-.8.9 0 1.5.8 1.7 1.2 1 .1 1.6-.7 1.8-1.1.1-.8.4-1.3.8-1.6-2.8-.3-5.8-1.4-5.8-6.2 0-1.4.5-2.6 1.3-3.5-.1-.3-.6-1.6.1-3.3 0 0 1.1-.3 3.6 1.3a12 12 0 016.6 0c2.5-1.6 3.6-1.3 3.6-1.3.7 1.7.2 3 .1 3.3.8.9 1.3 2.1 1.3 3.5 0 4.8-3 5.9-5.8 6.2.5.4.9 1.2.9 2.4v3.4A7.6 7.6 0 0012 4.5z" fill={meta.color} />
      </svg>
    );
  }
  if (platform === "rss") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="6.2" cy="17.8" r="1.8" fill={meta.color} />
        <path d="M5 11.4a7.7 7.7 0 017.6 7.6M5 6a13 13 0 0113 13" stroke={meta.color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (platform === "email") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.8" y="6.2" width="16.4" height="11.6" rx="2.3" stroke={meta.color} strokeWidth="1.6" />
        <path d="M4.8 7.4l7.2 5.3 7.2-5.3" stroke={meta.color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }
  if (platform === "web") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" stroke={meta.color} strokeWidth="1.6" />
        <path d="M4.8 12h14.4M12 4.8c2.1 2.1 3.2 4.6 3.2 7.2s-1.1 5.1-3.2 7.2m0-14.4C9.9 6.9 8.8 9.4 8.8 12s1.1 5.1 3.2 7.2" stroke={meta.color} strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" stroke={meta.color} strokeWidth="1.7" />
      <path d="M7.7 12h8.6M12 7.7v8.6" stroke={meta.color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
});

const CitationPill = React.memo(function CitationPill({
  item,
  onOpen,
}: {
  item: AelinCitation;
  onOpen?: (item: AelinCitation) => void;
}) {
  const platform = resolveCitationPlatform(item);
  const meta = PLATFORM_META[platform] || PLATFORM_META.generic;
  return (
    <Box
      onClick={() => onOpen?.(item)}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.55,
        px: 0.72,
        py: 0.35,
        borderRadius: 999,
        border: "1px solid",
        borderColor: meta.border,
        bgcolor: meta.bg,
        color: meta.color,
        fontSize: "0.74rem",
        lineHeight: 1.2,
        transition: "transform 160ms ease, box-shadow 180ms ease, filter 180ms ease",
        boxShadow: "0 0 0 rgba(0,0,0,0)",
        cursor: onOpen ? "pointer" : "default",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: `0 8px 18px ${alpha(meta.color, 0.2)}`,
          filter: "saturate(1.08)",
        },
      }}
      title={`${item.source_label} | ${item.title}`}
    >
      <PlatformGlyph platform={platform} size={13} />
      <AccountAvatar name={item.sender || item.source_label} src={item.sender_avatar_url} size={16} />
      <Typography
        component="span"
        sx={{
          fontSize: "0.73rem",
          fontWeight: 700,
          lineHeight: 1,
          maxWidth: 88,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {item.sender || item.source_label}
      </Typography>
      <Typography component="span" sx={{ fontSize: "0.74rem", fontWeight: 700, lineHeight: 1 }}>
        {item.source_label}
      </Typography>
      <Typography component="span" sx={{ fontSize: "0.72rem", opacity: 0.78, lineHeight: 1 }}>
        {item.received_at.slice(5)}
      </Typography>
    </Box>
  );
});

const ToolTraceRow = React.memo(function ToolTraceRow({ steps }: { steps: AelinToolStep[] }) {
  const normalized = (steps || []).map(normalizeTraceStep).slice(0, 6);
  if (!normalized.length) return null;
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mb: 0.55, px: 0.2 }}>
      {normalized.map((step, idx) => {
        const done = step.status === "completed";
        const running = step.status === "running";
        const failed = step.status === "failed";
        const skipped = step.status === "skipped";
        const color = failed ? "#d1495b" : done ? "#2a9d8f" : skipped ? "#7c7c7c" : "#f4a261";
        return (
          <Chip
            key={`${step.stage}-${idx}`}
            size="small"
            variant="outlined"
            label={`${toolStepLabel(step.stage)}${step.count ? ` ${step.count}` : ""}`}
            sx={{
              borderColor: alpha(color, 0.45),
              color,
              bgcolor: alpha(color, 0.1),
              "& .MuiChip-label": { px: 1, fontSize: "0.68rem", fontWeight: 700 },
              ...(running
                ? {
                    "@keyframes tracePulse": {
                      "0%, 100%": { transform: "scale(1)", filter: "saturate(1)" },
                      "50%": { transform: "scale(1.04)", filter: "saturate(1.2)" },
                    },
                    animation: "tracePulse 900ms ease-in-out infinite",
                  }
                : {}),
            }}
            title={step.detail || ""}
          />
        );
      })}
    </Stack>
  );
});

const ResultDeck = React.memo(function ResultDeck({ cards, pulse }: { cards: ResultCard[]; pulse?: boolean }) {
  if (!cards.length) return null;
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(176px, 1fr))",
        gap: 0.65,
        mb: 0.75,
        "@keyframes deckPulse": {
          "0%, 100%": { transform: "translateY(0)", boxShadow: "0 0 0 rgba(0,0,0,0)" },
          "50%": { transform: "translateY(-1px)", boxShadow: "0 10px 18px rgba(0,0,0,0.08)" },
        },
      }}
    >
      {cards.slice(0, 6).map((card) => (
        <Paper
          key={card.id}
          variant="outlined"
          sx={{
            px: 0.95,
            py: 0.72,
            borderRadius: 1.3,
            borderColor: alpha(card.accent, 0.42),
            bgcolor: alpha(card.accent, 0.08),
            animation: pulse ? "deckPulse 900ms ease-in-out 1" : "none",
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.3 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: alpha(card.accent, 0.95), lineHeight: 1.2 }}>
              {card.title}
            </Typography>
            <Box sx={{ color: alpha(card.accent, 0.9), display: "flex", alignItems: "center" }}>{card.icon}</Box>
          </Stack>
          <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.25 }}>
            {card.value}
          </Typography>
          {card.subtitle ? (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.2, display: "block", lineHeight: 1.35 }}>
              {card.subtitle}
            </Typography>
          ) : null}
        </Paper>
      ))}
    </Box>
  );
});

function renderRichMessageContent(content: string, resolveAvatarSrc?: (account: string) => string | undefined) {
  const renderTextWithLinks = (text: string, keyPrefix: string) => {
    const out: React.ReactNode[] = [];
    const mdRegex = /\[([^\]\n]{1,120})\]\((https?:\/\/[^\s)]+)\)/g;
    let mdLast = 0;
    let mdSeg = 0;
    let mdMatch: RegExpExecArray | null = null;

    const pushPlainUrls = (plain: string, plainKey: string) => {
      const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/g;
      let last = 0;
      let seg = 0;
      let m: RegExpExecArray | null = null;
      while ((m = urlRegex.exec(plain)) !== null) {
        const start = m.index;
        const end = start + m[0].length;
        if (start > last) out.push(plain.slice(last, start));
        const href = m[0];
        out.push(
          <Box
            key={`${plainKey}-url-${seg}`}
            component="a"
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: "primary.main", textDecoration: "underline", textUnderlineOffset: "2px" }}
          >
            {href}
          </Box>
        );
        last = end;
        seg += 1;
      }
      if (last < plain.length) out.push(plain.slice(last));
    };

    while ((mdMatch = mdRegex.exec(text)) !== null) {
      const start = mdMatch.index;
      const end = start + mdMatch[0].length;
      if (start > mdLast) pushPlainUrls(text.slice(mdLast, start), `${keyPrefix}-plain-${mdSeg}`);
      const label = mdMatch[1];
      const href = mdMatch[2];
      out.push(
        <Box
          key={`${keyPrefix}-md-${mdSeg}`}
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "primary.main", textDecoration: "underline", textUnderlineOffset: "2px" }}
        >
          {label}
        </Box>
      );
      mdLast = end;
      mdSeg += 1;
    }
    if (mdLast < text.length) pushPlainUrls(text.slice(mdLast), `${keyPrefix}-tail`);
    return out;
  };

  const lines = content.split("\n");
  return lines.map((line, lineIdx) => {
    const bulletMatch = line.match(
      /^(\s*[-*]\s*)?\[([^[\]\n]{1,24})\]\s*(.+?)（([^，()]{1,40})，([^）]{1,32})）(.*)$/
    );
    if (bulletMatch) {
      const prefix = bulletMatch[1] || "";
      const platform = normalizePlatformName(bulletMatch[2] || "");
      const title = (bulletMatch[3] || "").trim();
      const sender = (bulletMatch[4] || "").trim();
      const time = (bulletMatch[5] || "").trim();
      const tail = bulletMatch[6] || "";
      if (platform) {
        const avatarSrc = sender ? resolveAvatarSrc?.(sender) : undefined;
        const suffix = `${title ? ` ${title}` : ""}${time ? `（${time}）` : ""}${tail}`;
        return (
          <React.Fragment key={`line-${lineIdx}`}>
            {prefix}
            <InlineSourceBadge platform={platform} account={sender} avatarSrc={avatarSrc} />
            {renderTextWithLinks(suffix, `bullet-${lineIdx}`)}
            {lineIdx < lines.length - 1 ? <br /> : null}
          </React.Fragment>
        );
      }
    }

    const nodes: React.ReactNode[] = [];
    const regex = /\[([^[\]\n]{1,24})\](?:\s*@?([a-zA-Z0-9_\-.\u4e00-\u9fff]{2,40}))?/g;
    let last = 0;
    let match: RegExpExecArray | null = null;
    let seg = 0;
    while ((match = regex.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      if (start > last) nodes.push(...renderTextWithLinks(line.slice(last, start), `line-${lineIdx}-seg-${seg}`));
      const platform = normalizePlatformName(match[1] || "");
      if (platform) {
        const account = (match[2] || "").trim();
        const shouldAt = account && match[0].includes("@");
        const label = shouldAt ? `@${account}` : account;
        const avatarSrc = account ? resolveAvatarSrc?.(account) : undefined;
        nodes.push(
          <InlineSourceBadge
            key={`badge-${lineIdx}-${seg}`}
            platform={platform}
            account={label}
            avatarSrc={avatarSrc}
          />
        );
      } else {
        nodes.push(...renderTextWithLinks(match[0], `line-${lineIdx}-raw-${seg}`));
      }
      last = end;
      seg += 1;
    }
    if (last < line.length) nodes.push(...renderTextWithLinks(line.slice(last), `line-${lineIdx}-tail`));
    return (
      <React.Fragment key={`line-${lineIdx}`}>
        {nodes}
        {lineIdx < lines.length - 1 ? <br /> : null}
      </React.Fragment>
    );
  });
}

function looksLikeMarkdown(content: string): boolean {
  const text = (content || "").trim();
  if (!text) return false;
  if (text.includes("```")) return true;
  if (/^\s{0,3}#{1,6}\s+/m.test(text)) return true;
  if (/^\s{0,3}(\*|-|\+)\s+/m.test(text)) return true;
  if (/^\s{0,3}\d+\.\s+/m.test(text)) return true;
  if (/\[[^\]\n]{1,120}\]\((https?:\/\/[^\s)]+)\)/.test(text)) return true;
  if (/^\s*>\s+/m.test(text)) return true;
  if (/\|.*\|/.test(text) && /\n/.test(text)) return true;
  return false;
}

function normalizeAutoLinksForMarkdown(content: string): string {
  const text = content || "";
  return text.replace(/(^|[\s(])((https?:\/\/[^\s<>"')\]]+))/g, (_m, p1: string, p2: string) => {
    // Avoid breaking existing markdown links.
    if (p1.endsWith("](")) return `${p1}${p2}`;
    return `${p1}<${p2}>`;
  });
}

const MessageRow = React.memo(function MessageRow(props: {
  message: ChatMessage;
  isGroupStart: boolean;
  onActionClick: (action: AelinAction) => void;
  onCopy: (text: string) => void;
  onCitationOpen: (item: AelinCitation) => void;
  pulse?: boolean;
}) {
  const { message, isGroupStart, onActionClick, onCopy, onCitationOpen, pulse } = props;
  const theme = useTheme();
  const isUser = message.role === "user";
  const [hovered, setHovered] = React.useState(false);
  const cards = React.useMemo(() => cardsFromMessage(message), [message]);
  const accountAvatarMap = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const item of message.citations || []) {
      if (!item.sender_avatar_url) continue;
      const senderKey = normalizeAccountKey(item.sender || "");
      if (senderKey) map.set(senderKey, item.sender_avatar_url);
    }
    return map;
  }, [message.citations]);
  const resolveAvatarSrc = React.useCallback(
    (account: string) => {
      const key = normalizeAccountKey(account);
      if (!key) return undefined;
      return accountAvatarMap.get(key);
    },
    [accountAvatarMap]
  );

  return (
    <Box
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        "@keyframes aelinMessageIn": {
          from: { opacity: 0, transform: "translateY(10px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: 1.1,
        px: { xs: 1.2, md: 2.4 },
        py: isGroupStart ? 1.1 : 0.4,
        animation: "aelinMessageIn 220ms ease",
      }}
    >
      {!isUser ? (
        <Avatar
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.2,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            opacity: isGroupStart ? 1 : 0,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 17, color: "primary.main" }} />
        </Avatar>
      ) : (
        <Box sx={{ width: 36, height: 36 }} />
      )}

      <Box sx={{ maxWidth: "78%", minWidth: 58 }}>
        {isGroupStart ? (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", px: 0.65, mb: 0.5, textAlign: isUser ? "right" : "left", fontSize: "0.8rem" }}
          >
            {formatTime(message.ts)}
          </Typography>
        ) : null}

        <Paper
          variant="outlined"
          sx={{
            px: 1.35,
            py: 1.05,
            borderRadius: 1.75,
            bgcolor: isUser
              ? alpha(theme.palette.text.primary, theme.palette.mode === "light" ? 0.06 : 0.18)
              : "background.paper",
            transition: "transform 180ms ease, box-shadow 200ms ease",
            boxShadow: hovered ? `0 10px 20px ${alpha(theme.palette.text.primary, 0.08)}` : "none",
            transform: hovered ? "translateY(-1px)" : "translateY(0)",
          }}
        >
          {!isUser ? <ToolTraceRow steps={message.tool_trace || []} /> : null}
          {!isUser ? <ResultDeck cards={cards} pulse={pulse} /> : null}
          {message.images?.length ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
                gap: 0.7,
                mb: message.content ? 0.85 : 0,
              }}
            >
              {message.images.map((img, idx) => (
                <Box
                  key={`${message.id}-img-${idx}`}
                  component="img"
                  src={img.data_url}
                  alt={img.name || `image-${idx + 1}`}
                  sx={{
                    width: "100%",
                    maxHeight: 180,
                    objectFit: "cover",
                    borderRadius: 1.1,
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                />
              ))}
            </Box>
          ) : null}

          {message.pending ? (
            <Stack direction="row" spacing={0.9} alignItems="center">
              <TypingDots />
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: "0.98rem" }}>
                Aelin 正在思考...
              </Typography>
            </Stack>
          ) : (
            <Box sx={{ wordBreak: "break-word", lineHeight: 1.72, fontSize: "1rem" }}>
              {looksLikeMarkdown(message.content) ? (
                <Box
                  sx={{
                    "& p": { m: 0, mb: 1.05, lineHeight: 1.74 },
                    "& p:last-of-type": { mb: 0 },
                    "& ul, & ol": { mt: 0.25, mb: 1.05, pl: 2.3 },
                    "& li": { mb: 0.4 },
                    "& pre": {
                      m: 0,
                      mt: 0.6,
                      p: 1,
                      borderRadius: 1.2,
                      bgcolor: alpha(theme.palette.text.primary, 0.06),
                      overflowX: "auto",
                    },
                    "& code": {
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      fontSize: "0.86em",
                    },
                    "& blockquote": {
                      m: 0,
                      my: 0.8,
                      pl: 1.1,
                      borderLeft: "3px solid",
                      borderColor: alpha(theme.palette.primary.main, 0.38),
                      color: "text.secondary",
                    },
                  }}
                >
                  <ReactMarkdown
                    components={{
                      a: ({ ...props }) => (
                        <a
                          {...props}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: theme.palette.primary.main, textDecoration: "underline", textUnderlineOffset: "2px" }}
                        />
                      ),
                    }}
                  >
                    {normalizeAutoLinksForMarkdown(message.content)}
                  </ReactMarkdown>
                </Box>
              ) : (
                <Box sx={{ whiteSpace: "pre-wrap" }}>
                  {renderRichMessageContent(message.content, resolveAvatarSrc)}
                </Box>
              )}
            </Box>
          )}
        </Paper>

        {!!message.citations?.length && (
          <Stack direction="row" spacing={0.55} flexWrap="wrap" useFlexGap sx={{ mt: 0.7, px: 0.45 }}>
            {message.citations.slice(0, 4).map((item) => (
              <CitationPill key={`${message.id}-${item.message_id}-${item.source}`} item={item} onOpen={onCitationOpen} />
            ))}
          </Stack>
        )}

        {!!message.actions?.length && (
          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.6, px: 0.45 }}>
            {message.actions
              .filter((action) => action.kind !== "confirm_track")
              .slice(0, 3)
              .map((action, idx) => (
              <Button
                key={`${message.id}-${action.kind}-${idx}`}
                size="small"
                variant="outlined"
                onClick={() => onActionClick(action)}
              >
                {action.title}
              </Button>
            ))}
          </Stack>
        )}

        {!message.pending ? (
          <Stack
            direction="row"
            justifyContent={isUser ? "flex-end" : "flex-start"}
            sx={{ mt: 0.2, px: 0.3, opacity: hovered ? 1 : 0, transition: "opacity 140ms ease" }}
          >
            <IconButton size="small" onClick={() => onCopy(message.content)}>
              <ContentCopyIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
});

export default function Aelin({
  embedded = false,
  workspace = "default",
  onOpenDesk,
  onRequestClose,
}: AelinProps) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const boot = React.useMemo(() => loadPersistedSessions(), []);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [storyBusy, setStoryBusy] = React.useState(false);
  const [sessions, setSessions] = React.useState<ChatSession[]>(boot.sessions);
  const [activeSessionId, setActiveSessionId] = React.useState<string>(boot.activeId);
  const [pendingImages, setPendingImages] = React.useState<PendingImage[]>([]);
  const [contextSnapshot, setContextSnapshot] = React.useState<AelinContextResponse | null>(null);
  const [trackingSheet, setTrackingSheet] = React.useState<TrackingSheetState | null>(null);
  const [trackingDialogOpen, setTrackingDialogOpen] = React.useState(false);
  const [trackingItems, setTrackingItems] = React.useState<AelinTrackingItem[]>([]);
  const [trackingBusy, setTrackingBusy] = React.useState(false);
  const [trackingError, setTrackingError] = React.useState("");
  const [handoffFX, setHandoffFX] = React.useState<HandoffFXState | null>(null);
  const [latestSparkMessageId, setLatestSparkMessageId] = React.useState<string>("");
  const dismissedTrackTargetsRef = React.useRef<Record<string, true>>({});
  const [citationDrawer, setCitationDrawer] = React.useState<{
    open: boolean;
    citation: AelinCitation | null;
    detail: MessageDetail | null;
    loading: boolean;
    error: string;
  }>({ open: false, citation: null, detail: null, loading: false, error: "" });
  const timelineRef = React.useRef<HTMLDivElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const handledDeskReturnRef = React.useRef<string>("");
  const handoffFXTimerRef = React.useRef<number | null>(null);
  const activeSession = React.useMemo(
    () => sessions.find((item) => item.id === activeSessionId) || sessions[0],
    [activeSessionId, sessions]
  );
  const messages = activeSession?.messages || [];
  const sortedSessions = React.useMemo(
    () => sessions.slice().sort((a, b) => b.updated_at - a.updated_at),
    [sessions]
  );
  const groupedMessages = useGroupedMessages(messages);
  const slashMatches = React.useMemo(() => matchingSlashCommands(input), [input]);
  const workspaceScope = React.useMemo(() => (workspace || "default").trim() || "default", [workspace]);
  const lastAssistantCitation = React.useMemo(() => {
    const reversed = [...messages].reverse();
    for (const item of reversed) {
      if (item.role !== "assistant") continue;
      const first = (item.citations || [])[0];
      if (first) return first;
    }
    return null;
  }, [messages]);

  const playHandoffFX = React.useCallback((title: string, detail: string, holdMs = 900) => {
    setHandoffFX({ title, detail });
    if (handoffFXTimerRef.current !== null) {
      window.clearTimeout(handoffFXTimerRef.current);
    }
    handoffFXTimerRef.current = window.setTimeout(() => {
      setHandoffFX(null);
      handoffFXTimerRef.current = null;
    }, holdMs);
  }, []);

  const openDeskWithContext = React.useCallback(
    (args?: {
      messageId?: number | string;
      contactId?: number | string;
      focusQuery?: string;
      highlightSource?: string;
      resumePrompt?: string;
    }) => {
      const sid = (activeSession?.id || activeSessionId || "").trim();
      const messageNum = Number(args?.messageId ?? 0);
      const contactNum = Number(args?.contactId ?? 0);
      const source = (args?.highlightSource || "").trim();
      const focusQuery = (args?.focusQuery || "").trim();
      const resumePrompt = (args?.resumePrompt || "").trim();

      const qs = new URLSearchParams();
      qs.set("from", "aelin");
      qs.set("workspace", workspaceScope);
      if (sid) qs.set("session_id", sid);
      if (Number.isFinite(messageNum) && messageNum > 0) qs.set("focus_message_id", String(Math.floor(messageNum)));
      if (Number.isFinite(contactNum) && contactNum > 0) qs.set("focus_contact_id", String(Math.floor(contactNum)));
      if (focusQuery) qs.set("focus_query", focusQuery.slice(0, 180));
      if (source) qs.set("highlight_source", source.slice(0, 40));
      if (resumePrompt) qs.set("resume_prompt", resumePrompt.slice(0, 240));

      if (typeof window !== "undefined") {
        try {
          if (sid) window.localStorage.setItem(AELIN_LAST_SESSION_KEY, sid);
          window.sessionStorage.setItem(
            AELIN_LAST_DESK_BRIDGE_KEY,
            JSON.stringify({
              from: "aelin",
              session_id: sid,
                focus_message_id: Number.isFinite(messageNum) && messageNum > 0 ? Math.floor(messageNum) : undefined,
                focus_contact_id: Number.isFinite(contactNum) && contactNum > 0 ? Math.floor(contactNum) : undefined,
                focus_query: focusQuery || undefined,
                workspace: workspaceScope,
                highlight_source: source || undefined,
                resume_prompt: resumePrompt || undefined,
                ts: Date.now(),
              })
            );
        } catch {
          // ignore storage failures
        }
      }
      if (onOpenDesk) {
        playHandoffFX(
          "Aelin -> Desk",
          focusQuery ? `正在定位主题“${focusQuery.slice(0, 36)}”` : "正在打开观察视图"
        );
        onOpenDesk({
          sessionId: sid,
          workspace: workspaceScope,
          messageId: Number.isFinite(messageNum) && messageNum > 0 ? Math.floor(messageNum) : undefined,
          contactId: Number.isFinite(contactNum) && contactNum > 0 ? Math.floor(contactNum) : undefined,
          focusQuery: focusQuery || undefined,
          highlightSource: source || undefined,
          resumePrompt: resumePrompt || undefined,
        });
        return;
      }
      playHandoffFX(
        "Aelin -> Desk",
        focusQuery ? `正在定位主题“${focusQuery.slice(0, 36)}”` : "正在打开观察视图"
      );
      window.setTimeout(() => {
        navigate(`/desk?${qs.toString()}`);
      }, 140);
    },
    [activeSession?.id, activeSessionId, navigate, onOpenDesk, playHandoffFX, workspaceScope]
  );

  const refreshContext = React.useCallback(async () => {
    try {
      const ctx = await getAelinContext(workspaceScope, "");
      setContextSnapshot(ctx);
    } catch {
      // ignore temporary context fetch failures
    }
  }, [workspaceScope]);

  const refreshTracking = React.useCallback(async () => {
    setTrackingBusy(true);
    setTrackingError("");
    try {
      const ret = await getAelinTracking(120);
      setTrackingItems(ret.items || []);
    } catch (error) {
      setTrackingError(error instanceof Error ? error.message : "跟踪列表加载失败");
    } finally {
      setTrackingBusy(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshContext();
  }, [refreshContext]);

  React.useEffect(() => {
    if (!trackingDialogOpen) return;
    void refreshTracking();
  }, [refreshTracking, trackingDialogOpen]);

  React.useEffect(() => {
    void refreshTracking();
  }, [refreshTracking]);

  React.useEffect(() => {
    return () => {
      if (handoffFXTimerRef.current !== null) {
        window.clearTimeout(handoffFXTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!sessions.length) {
      const created = newSession();
      setSessions([created]);
      setActiveSessionId(created.id);
      return;
    }
    if (!sessions.some((item) => item.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  React.useEffect(() => {
    setTrackingSheet(null);
  }, [activeSessionId]);

  const updateActiveMessages = React.useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) return session;
          const nextMessages = updater(session.messages || []);
          return {
            ...session,
            messages: nextMessages,
            title: deriveSessionTitle(nextMessages),
            updated_at: Date.now(),
          };
        })
      );
    },
    [activeSessionId]
  );

  React.useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  React.useEffect(() => {
    if (!latestSparkMessageId) return;
    const timer = window.setTimeout(() => setLatestSparkMessageId(""), 1400);
    return () => window.clearTimeout(timer);
  }, [latestSparkMessageId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const compact = sessions
        .slice()
        .sort((a, b) => b.updated_at - a.updated_at)
        .slice(0, MAX_PERSISTED_SESSIONS)
        .map((session) => ({
          id: session.id,
          title: session.title,
          updated_at: session.updated_at,
          messages: toPersistedMessages(session.messages || []),
        }));
      const payload = { version: 1, sessions: compact, active_id: activeSessionId, saved_at: Date.now() };
      window.localStorage.setItem(AELIN_SESSIONS_STORAGE_KEY, JSON.stringify(payload));
      window.localStorage.removeItem(AELIN_CHAT_STORAGE_KEY);
    } catch {
      // Ignore storage failures (e.g., quota exceeded/private mode restrictions).
    }
  }, [activeSessionId, sessions]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(AELIN_LAST_SESSION_KEY, activeSessionId);
    } catch {
      // ignore storage failures
    }
  }, [activeSessionId]);

  React.useEffect(() => {
    if (embedded) return;
    const currentSearch = location.search || "";
    if (!currentSearch) return;
    if (handledDeskReturnRef.current === currentSearch) return;
    const qs = new URLSearchParams(currentSearch);
    if ((qs.get("from") || "").trim().toLowerCase() !== "desk") return;
    handledDeskReturnRef.current = currentSearch;

    const sid = (qs.get("session_id") || "").trim();
    const focusQuery = (qs.get("focus_query") || "").trim();
    const resumePrompt = (qs.get("resume_prompt") || "").trim();
    const focusMessageId = Number(qs.get("focus_message_id") || 0);
    const source = (qs.get("highlight_source") || "").trim();

    if (sid && sessions.some((item) => item.id === sid)) {
      setActiveSessionId(sid);
    }
    if (resumePrompt) {
      setInput((prev) => (prev.trim() ? prev : resumePrompt));
    } else if (focusQuery) {
      setInput((prev) => (prev.trim() ? prev : `继续围绕这个主题：${focusQuery}`));
    }
    if (Number.isFinite(focusMessageId) && focusMessageId > 0) {
      playHandoffFX(
        "Desk -> Aelin",
        source
          ? `已带回 ${source} 的观察结果（消息 #${focusMessageId}）`
          : `已带回焦点消息 #${focusMessageId}`
      );
      showToast(
        source ? `已从 Desk 返回，继续围绕 ${source}（消息 #${focusMessageId}）` : `已从 Desk 返回，焦点消息 #${focusMessageId}`,
        "info"
      );
    } else {
      playHandoffFX("Desk -> Aelin", "已返回聊天，可继续追问");
      showToast("已从 Desk 返回，可继续追问。", "info");
    }
    navigate("/", { replace: true });
  }, [embedded, location.search, navigate, playHandoffFX, sessions, showToast]);

  const resetConversation = React.useCallback(() => {
    const created = newSession();
    setSessions((prev) => [created, ...prev].slice(0, MAX_PERSISTED_SESSIONS));
    setActiveSessionId(created.id);
    setPendingImages([]);
    setTrackingSheet(null);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(AELIN_CHAT_STORAGE_KEY);
      } catch {
        // no-op
      }
    }
  }, []);

  const copyText = React.useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast("已复制", "success");
      } catch {
        showToast("复制失败", "error");
      }
    },
    [showToast]
  );

  const appendFiles = React.useCallback(
    async (files: File[]) => {
      const existing = pendingImages.length;
      if (existing >= 4) {
        showToast("最多上传 4 张图片", "info");
        return;
      }
      const candidates = files.filter((file) => file.type.startsWith("image/")).slice(0, 4 - existing);
      if (!candidates.length) {
        showToast("请选择图片文件", "info");
        return;
      }
      const oversized = candidates.find((file) => file.size > 4 * 1024 * 1024);
      if (oversized) {
        showToast(`图片过大：${oversized.name}（限制 4MB）`, "error");
        return;
      }
      try {
        const urls = await Promise.all(candidates.map((file) => fileToDataUrl(file)));
        setPendingImages((prev) => [
          ...prev,
          ...urls.map((dataUrl, idx) => ({
            id: nextMessageId(),
            dataUrl,
            name: candidates[idx]?.name || `image-${Date.now()}`,
          })),
        ]);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "图片读取失败", "error");
      }
    },
    [pendingImages.length, showToast]
  );

  const send = React.useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if ((!query && pendingImages.length === 0) || busy) return;
      const transformedQuery = transformSlashCommand(query || "请分析我上传的图片并结合上下文回复。");

      setBusy(true);
      setInput("");
      const assistantId = nextMessageId();
      const nowTs = Date.now();
      const sessionIdAtSend = activeSessionId;
      const historyForSend = (activeSession?.messages || [])
        .filter((item) => !item.pending && (item.role === "user" || item.role === "assistant"))
        .slice(-10)
        .map((item) => ({ role: item.role, content: item.content }));
      const imagesForSend: AelinImageInput[] = pendingImages.slice(0, 4).map((img) => ({
        data_url: img.dataUrl,
        name: img.name,
      }));
      setPendingImages([]);

      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionIdAtSend
            ? {
                ...session,
                messages: [
                  ...session.messages,
                  { id: nextMessageId(), role: "user", content: query || "（图片）", ts: nowTs, images: imagesForSend },
                  {
                    id: assistantId,
                    role: "assistant",
                    content: "",
                    ts: nowTs + 1,
                    pending: true,
                    tool_trace: [{ stage: "planner", status: "running", detail: "正在规划工具链路", count: 0 }],
                  },
                ],
                title: deriveSessionTitle([
                  ...session.messages,
                  { id: "tmp", role: "user", content: query || "（图片）", ts: nowTs, images: imagesForSend },
                ]),
                updated_at: Date.now(),
              }
            : session
        )
      );

      try {
        const result = await aelinChat(transformedQuery, {
          use_memory: true,
          max_citations: 8,
          workspace: workspaceScope,
          images: imagesForSend,
          history: historyForSend,
        });
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionIdAtSend
              ? {
                  ...session,
                  messages: session.messages.map((item) =>
                    item.id === assistantId
                      ? {
                          ...item,
                          pending: false,
                          content: result.answer || "当前未生成文本回答。",
                          citations: result.citations || [],
                          actions: result.actions || [],
                          tool_trace: (result.tool_trace || []).map(normalizeTraceStep),
                        }
                      : item
                  ),
                  updated_at: Date.now(),
                }
              : session
          )
        );
        setLatestSparkMessageId(assistantId);
        const trackAction = (result.actions || []).find((it) => it.kind === "confirm_track");
        if (trackAction) {
          const target = (trackAction.payload.target || "").trim().toLowerCase();
          if (!dismissedTrackTargetsRef.current[target]) {
            setTrackingSheet({ action: trackAction, messageId: assistantId });
          }
        } else {
          setTrackingSheet(null);
        }
        void refreshContext();
      } catch (error) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === sessionIdAtSend
              ? {
                  ...session,
                  messages: session.messages.map((item) =>
                    item.id === assistantId
                      ? {
                          ...item,
                          pending: false,
                          content:
                            error instanceof Error
                              ? `请求失败：${error.message}`
                              : "请求失败，请稍后重试。",
                          tool_trace: [
                            { stage: "planner", status: "completed", detail: "request prepared", count: 1 },
                            {
                              stage: "generation",
                              status: "failed",
                              detail: error instanceof Error ? error.message : "request failed",
                              count: 0,
                            },
                          ],
                        }
                      : item
                  ),
                  updated_at: Date.now(),
                }
              : session
          )
        );
      } finally {
        setBusy(false);
      }
    },
    [activeSession?.messages, activeSessionId, busy, pendingImages, refreshContext, workspaceScope]
  );

  const onActionClick = React.useCallback(
    async (action: AelinAction) => {
      if (action.kind === "open_desk" || action.kind === "open_todos") {
        const path = action.payload.path || "/desk";
        if (path.startsWith("/desk")) {
          openDeskWithContext({
            messageId: action.payload.message_id,
            contactId: action.payload.contact_id,
            focusQuery: action.payload.query || "",
            highlightSource: action.payload.source || lastAssistantCitation?.source_label || "",
            resumePrompt: action.payload.query || "",
          });
        } else {
          navigate(path);
        }
        return;
      }
      if (action.kind === "open_settings") {
        navigate(action.payload.path || "/settings");
        return;
      }
      if (action.kind === "open_message") {
        const messageId = action.payload.message_id;
        openDeskWithContext({
          messageId,
          contactId: action.payload.contact_id,
          focusQuery: action.payload.query || "",
          highlightSource: action.payload.source || lastAssistantCitation?.source_label || "",
          resumePrompt: action.payload.query || "",
        });
        return;
      }
      if (action.kind === "track_topic") {
        setInput(action.payload.query || "");
        showToast("已填入追踪主题。", "info");
        return;
      }
      if (action.kind === "confirm_track") {
        setTrackingSheet({ action, messageId: nextMessageId() });
      }
    },
    [lastAssistantCitation?.source_label, navigate, openDeskWithContext, showToast]
  );

  const handleCitationOpen = React.useCallback(
    async (item: AelinCitation) => {
      setCitationDrawer({ open: true, citation: item, detail: null, loading: true, error: "" });
      try {
        const detail = await getMessage(item.message_id);
        setCitationDrawer({ open: true, citation: item, detail, loading: false, error: "" });
      } catch (error) {
        setCitationDrawer({
          open: true,
          citation: item,
          detail: null,
          loading: false,
          error: error instanceof Error ? error.message : "加载详情失败",
        });
      }
    },
    []
  );

  const handleTrackingChoice = React.useCallback(
    async (mode: "track" | "once" | "dismiss") => {
      if (!trackingSheet) return;
      const target = (trackingSheet.action.payload.target || "").trim();
      if (!target) {
        setTrackingSheet(null);
        return;
      }
      if (mode === "dismiss") {
        dismissedTrackTargetsRef.current[target.toLowerCase()] = true;
        setTrackingSheet(null);
        showToast("已关闭该主题的跟踪提醒", "info");
        return;
      }
      if (mode === "once") {
        setTrackingSheet(null);
        showToast("本次仅回答，不开启持续跟踪", "info");
        return;
      }
      try {
        const ret = await aelinConfirmTrack({
          target,
          source: trackingSheet.action.payload.source || "auto",
          query: trackingSheet.action.payload.query || "",
        });
        updateActiveMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "assistant",
            content: ret.message || "已处理你的跟踪请求。",
            ts: Date.now(),
            actions: ret.actions || [],
          },
        ]);
        setTrackingSheet(null);
        void refreshContext();
        void refreshTracking();
        if (ret.status === "needs_config") {
          const goSettings = await confirm({
            title: "需要先配置数据源",
            message: `当前缺少 ${ret.provider || "对应"} 配置，是否现在前往设置？`,
            confirmLabel: "去设置",
            cancelLabel: "稍后",
          });
          if (goSettings) navigate("/settings");
        } else {
          showToast("已开启持续跟踪", "success");
        }
      } catch (error) {
        showToast(error instanceof Error ? error.message : "跟踪开启失败", "error");
      }
    },
    [confirm, navigate, refreshContext, refreshTracking, showToast, trackingSheet, updateActiveMessages]
  );

  const runStoryMode = React.useCallback(async () => {
    setStoryBusy(true);
    try {
      const ctx = contextSnapshot || (await getAelinContext(workspaceScope, ""));
      if (!contextSnapshot) setContextSnapshot(ctx);
      const story = buildStoryFromContext(ctx);
      updateActiveMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "assistant",
          content: story,
          ts: Date.now(),
          tool_trace: [
            { stage: "planner", status: "completed", detail: "story mode enabled", count: 1 },
            { stage: "local_search", status: "completed", detail: "used 24h local context", count: (ctx.focus_items || []).length },
          ],
        },
      ]);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "故事模式生成失败", "error");
    } finally {
      setStoryBusy(false);
    }
  }, [contextSnapshot, showToast, updateActiveMessages, workspaceScope]);

  return (
    <Box
      component={motion.div}
      initial={embedded ? undefined : { opacity: 0, y: 8 }}
      animate={embedded ? undefined : { opacity: 1, y: 0 }}
      transition={embedded ? undefined : { duration: 0.24 }}
      sx={{
        height: embedded ? "100%" : "100dvh",
        maxHeight: embedded ? "100%" : "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          height: 64,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          position: "relative",
          zIndex: 2,
          bgcolor: alpha(theme.palette.background.default, 0.82),
          backdropFilter: "blur(8px)",
        }}
      >
        <Container maxWidth={embedded ? false : "md"} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: { xs: 1.2, sm: 2.2 } }}>
          <Stack direction="row" spacing={1.1} alignItems="center">
            <Avatar sx={{ width: 34, height: 34, borderRadius: 1.2, bgcolor: "background.paper", border: "1px solid", borderColor: "divider" }}>
              <AutoAwesomeIcon sx={{ fontSize: 17, color: "primary.main" }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.06, fontSize: "1.03rem" }}>
                Aelin
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
                Chat
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={0.6} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <Select
                value={activeSession?.id || ""}
                onChange={(event) => setActiveSessionId(String(event.target.value || ""))}
                displayEmpty
                sx={{
                  borderRadius: 1.4,
                  fontSize: "0.85rem",
                  "& .MuiSelect-select": { py: 0.6, pr: 2.2 },
                }}
              >
                {sortedSessions.map((session) => (
                  <MenuItem key={session.id} value={session.id}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 1 }}>
                      <Typography variant="body2" sx={{ maxWidth: 132, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {session.title || "新对话"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(session.updated_at)}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Tooltip title="新对话">
              <IconButton onClick={resetConversation}>
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="故事模式">
              <span>
                <IconButton onClick={runStoryMode} disabled={storyBusy}>
                  <TimelineIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="跟踪清单">
              <IconButton onClick={() => setTrackingDialogOpen(true)}>
                <Badge
                  color="primary"
                  badgeContent={Math.min(99, trackingItems.length)}
                  invisible={!trackingItems.length}
                  overlap="circular"
                >
                  <TrackChangesIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="设置">
              <IconButton onClick={() => navigate("/settings")}>
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {embedded && onRequestClose ? (
              <Tooltip title="收起 Aelin">
                <IconButton onClick={onRequestClose}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : null}
          </Stack>
        </Container>
      </Box>

      {handoffFX ? (
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.99 }}
          transition={{ duration: 0.2 }}
          sx={{
            position: "fixed",
            top: { xs: 72, md: 80 },
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1500,
            pointerEvents: "none",
            width: "min(620px, calc(100vw - 28px))",
          }}
        >
          <Paper
            variant="outlined"
            sx={{
              px: 1.1,
              py: 0.85,
              borderRadius: 1.8,
              borderColor: alpha(theme.palette.primary.main, 0.34),
              bgcolor: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: "blur(10px)",
              boxShadow: `0 12px 24px ${alpha(theme.palette.common.black, 0.14)}`,
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {handoffFX.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {handoffFX.detail}
            </Typography>
          </Paper>
        </Box>
      ) : null}

      <Box
        ref={timelineRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          pb: 1.6,
          overscrollBehaviorY: "contain",
        }}
      >
        <Container maxWidth={embedded ? false : "md"} sx={{ px: { xs: 0.2, sm: 0.4 }, py: 1.35 }}>
          {messages.length <= 1 ? (
            <Paper
              variant="outlined"
              sx={{
                px: 1.2,
                py: 1.1,
                borderRadius: 2.2,
                borderColor: alpha(theme.palette.primary.main, 0.28),
                background:
                  theme.palette.mode === "light"
                    ? "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(245,249,255,0.86))"
                    : "linear-gradient(135deg, rgba(34,34,34,0.96), rgba(22,28,36,0.86))",
                mb: 1.1,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.8 }}>
                <Stack direction="row" spacing={0.8} alignItems="center">
                  <BoltIcon sx={{ fontSize: 18, color: "primary.main" }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Today Focus
                  </Typography>
                </Stack>
                <Button
                  size="small"
                  startIcon={<AutoStoriesIcon sx={{ fontSize: 16 }} />}
                  onClick={runStoryMode}
                  disabled={storyBusy}
                >
                  {storyBusy ? "生成中..." : "故事模式"}
                </Button>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
                {contextSnapshot?.daily_brief?.summary || "正在读取你的每日简报与高价值信号..."}
              </Typography>

              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 0.7, mt: 0.95 }}>
                {(contextSnapshot?.daily_brief?.top_updates || []).slice(0, 3).map((item, idx) => (
                  <Paper
                    key={`${item.message_id}-${idx}`}
                    variant="outlined"
                    onClick={() => send(`请详细解释这个更新并告诉我为什么重要：${item.title}`)}
                    sx={{
                      px: 0.85,
                      py: 0.72,
                      borderRadius: 1.5,
                      borderColor: alpha(theme.palette.primary.main, 0.24),
                      bgcolor: alpha(theme.palette.primary.main, 0.06),
                      cursor: "pointer",
                      transition: "transform 160ms ease, box-shadow 200ms ease",
                      "&:hover": { transform: "translateY(-1px)", boxShadow: "0 10px 20px rgba(0,0,0,0.08)" },
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 700, color: "primary.main" }}>
                      {item.source_label}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.2, lineHeight: 1.35 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.sender} · {item.received_at}
                    </Typography>
                  </Paper>
                ))}
              </Box>

              <Divider sx={{ my: 0.95 }} />
              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ py: 0.2 }}>
                {QUICK_PROMPTS.map((prompt) => (
                  <Chip key={prompt} size="small" variant="outlined" clickable onClick={() => send(prompt)} label={prompt} />
                ))}
              </Stack>
              <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap sx={{ pt: 0.6 }}>
                {SLASH_COMMANDS.map((cmd) => (
                  <Chip
                    key={cmd.key}
                    size="small"
                    variant="filled"
                    onClick={() => setInput(cmd.template + " ")}
                    label={cmd.key}
                    sx={{
                      bgcolor: alpha(theme.palette.text.primary, 0.08),
                      color: "text.primary",
                      "& .MuiChip-label": { fontWeight: 700, fontSize: "0.71rem" },
                    }}
                  />
                ))}
              </Stack>
            </Paper>
          ) : null}

          {groupedMessages.map(({ message, isGroupStart }) => (
            <MessageRow
              key={message.id}
              message={message}
              isGroupStart={isGroupStart}
              onActionClick={onActionClick}
              onCopy={copyText}
              onCitationOpen={handleCitationOpen}
              pulse={latestSparkMessageId === message.id}
            />
          ))}
        </Container>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          pt: 1.1,
          pb: 1.35,
          px: 1.1,
          borderTop: "1px solid",
          borderColor: alpha(theme.palette.divider, 0.9),
          backdropFilter: "blur(8px)",
          background:
            theme.palette.mode === "light"
              ? "linear-gradient(to top, rgba(250,249,245,1), rgba(250,249,245,0.96), rgba(250,249,245,0.56), rgba(250,249,245,0))"
              : "linear-gradient(to top, rgba(20,20,19,1), rgba(20,20,19,0.96), rgba(20,20,19,0.52), rgba(20,20,19,0))",
        }}
      >
        <Container maxWidth={embedded ? false : "md"} sx={{ px: { xs: 0.2, sm: 0.4 } }}>
          <Paper
            variant="outlined"
            sx={{
              p: 0.9,
              borderRadius: 2.4,
              borderColor: alpha(theme.palette.divider, 0.95),
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.65, px: 0.1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                观察联动
              </Typography>
              <Button
                size="small"
                variant="text"
                startIcon={<TravelExploreIcon sx={{ fontSize: 15 }} />}
                onClick={() =>
                  openDeskWithContext({
                    messageId: lastAssistantCitation?.message_id,
                    focusQuery: (input || "").trim() || lastAssistantCitation?.title || "",
                    highlightSource: lastAssistantCitation?.source_label || lastAssistantCitation?.source || "",
                    resumePrompt:
                      ((input || "").trim() && `继续围绕这个问题讨论：${input.trim()}`) ||
                      (lastAssistantCitation?.title && `继续分析这条线索：${lastAssistantCitation.title}`) ||
                      "继续从观察视图里分析我的重点信息。",
                  })
                }
              >
                在 Desk 观察
              </Button>
            </Stack>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={async (event) => {
                const files = Array.from(event.target.files || []);
                if (!files.length) return;
                await appendFiles(files);
                event.target.value = "";
              }}
            />

            {pendingImages.length ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px, 1fr))", gap: 0.7, mb: 0.8 }}>
                {pendingImages.map((img) => (
                  <Box key={img.id} sx={{ position: "relative" }}>
                    <Box
                      component="img"
                      src={img.dataUrl}
                      alt={img.name}
                      sx={{
                        width: "100%",
                        height: 88,
                        objectFit: "cover",
                        borderRadius: 1.1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => setPendingImages((prev) => prev.filter((item) => item.id !== img.id))}
                      sx={{
                        position: "absolute",
                        right: 4,
                        top: 4,
                        bgcolor: alpha(theme.palette.background.paper, 0.88),
                        "&:hover": { bgcolor: alpha(theme.palette.background.paper, 1) },
                      }}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            ) : null}

            <Box sx={{ display: "flex", alignItems: "flex-end", gap: 0.8 }}>
              <Tooltip title="上传图片">
                <span>
                  <IconButton
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy || pendingImages.length >= 4}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 1.1,
                      border: "1px solid",
                      borderColor: "divider",
                      alignSelf: "flex-end",
                      mb: 0.2,
                    }}
                  >
                    <ImageIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <InputBase
                fullWidth
                multiline
                minRows={1}
                maxRows={8}
                placeholder="发送消息...（可用 /compare /track /digest /debate）"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onPaste={async (event) => {
                  const items = Array.from(event.clipboardData?.items || []);
                  const imageFiles: File[] = [];
                  for (const item of items) {
                    if (item.type.startsWith("image/")) {
                      const file = item.getAsFile();
                      if (file) imageFiles.push(file);
                    }
                  }
                  if (!imageFiles.length) return;
                  event.preventDefault();
                  await appendFiles(imageFiles);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Tab" && slashMatches.length > 0) {
                    event.preventDefault();
                    setInput(slashMatches[0].template + " ");
                    return;
                  }
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    send(input);
                  }
                }}
                sx={{
                  flex: 1,
                  px: 1,
                  py: 0.75,
                  fontSize: "1rem",
                  lineHeight: 1.6,
                  borderRadius: 1.6,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                  "& textarea": {
                    resize: "none",
                    p: 0,
                  },
                  "&.Mui-focused": {
                    borderColor: "primary.main",
                  },
                }}
              />
              <Button
                variant="contained"
                onClick={() => send(input)}
                disabled={busy || (!input.trim() && pendingImages.length === 0)}
                sx={{
                  minWidth: 36,
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  p: 0,
                  alignSelf: "flex-end",
                  mb: 0.2,
                  transition: "transform 180ms ease, box-shadow 200ms ease",
                  boxShadow: "0 6px 14px rgba(217,119,87,0.24)",
                  "&:hover": {
                    transform: "translateY(-1px) scale(1.03)",
                    boxShadow: "0 10px 20px rgba(217,119,87,0.3)",
                  },
                }}
              >
                <SendIcon sx={{ fontSize: 18 }} />
              </Button>
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.55, px: 0.6 }}>
              Enter 发送，Shift+Enter 换行
            </Typography>
            {slashMatches.length ? (
              <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.7, px: 0.35 }}>
                {slashMatches.map((cmd) => (
                  <Chip
                    key={cmd.key}
                    size="small"
                    variant="outlined"
                    onClick={() => setInput(cmd.template + " ")}
                    label={`${cmd.key} · ${cmd.helper}`}
                    sx={{ "& .MuiChip-label": { fontSize: "0.73rem", fontWeight: 600 } }}
                  />
                ))}
              </Stack>
            ) : null}
          </Paper>
        </Container>
      </Box>

      <Dialog
        open={trackingDialogOpen}
        onClose={() => setTrackingDialogOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: "hidden",
            bgcolor: alpha(theme.palette.background.paper, 0.98),
            backdropFilter: "blur(10px)",
          },
        }}
      >
        <Box sx={{ px: 1.2, py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={0.8} alignItems="center">
              <TrackChangesIcon sx={{ fontSize: 18, color: "primary.main" }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                正在跟踪
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.4}>
              <Tooltip title="刷新">
                <span>
                  <IconButton size="small" onClick={() => void refreshTracking()} disabled={trackingBusy}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton size="small" onClick={() => setTrackingDialogOpen(false)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
            <Chip size="small" label={`总数 ${trackingItems.length}`} />
            <Chip size="small" color="success" label={`进行中 ${trackingItems.filter((it) => it.status === "sync_started" || it.status === "active").length}`} />
            <Chip size="small" color="warning" label={`待配置 ${trackingItems.filter((it) => it.status === "needs_config").length}`} />
          </Stack>
        </Box>

        <Box sx={{ px: 1.2, py: 1.1, maxHeight: "68vh", overflowY: "auto" }}>
          {trackingBusy ? (
            <Stack direction="row" spacing={0.8} alignItems="center" sx={{ py: 2.6 }}>
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                正在加载跟踪清单...
              </Typography>
            </Stack>
          ) : trackingError ? (
            <Paper variant="outlined" sx={{ p: 1, borderRadius: 1.4 }}>
              <Typography variant="body2" color="error.main">
                {trackingError}
              </Typography>
              <Button size="small" sx={{ mt: 0.6 }} onClick={() => void refreshTracking()}>
                重试
              </Button>
            </Paper>
          ) : trackingItems.length ? (
            <Stack spacing={0.8}>
              {trackingItems.map((item) => {
                const status = formatTrackingStatus(item.status);
                const sourceLabel = TRACKING_SOURCE_LABEL[item.source] || item.source || "未知";
                return (
                  <Paper
                    key={`${item.note_id || "n"}-${item.message_id || "m"}-${item.source}-${item.target}`}
                    variant="outlined"
                    sx={{ p: 0.9, borderRadius: 1.5, borderColor: alpha(theme.palette.divider, 0.85) }}
                  >
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={0.9}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.35 }}>
                            {item.target}
                          </Typography>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.45 }}>
                            <Chip size="small" label={sourceLabel} variant="outlined" />
                            <Chip size="small" label={status.label} color={status.color} />
                          </Stack>
                        </Box>
                        {item.message_id ? (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              openDeskWithContext({
                                messageId: item.message_id || undefined,
                                focusQuery: item.query || item.target,
                                highlightSource: sourceLabel,
                                resumePrompt: `继续分析这个跟踪主题：${item.target}`,
                              });
                              setTrackingDialogOpen(false);
                            }}
                          >
                            查看详情
                          </Button>
                        ) : null}
                      </Stack>

                      {item.query ? (
                        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                          触发问题：{item.query}
                        </Typography>
                      ) : null}
                      <Typography variant="caption" color="text.secondary">
                        最近更新：{formatIsoTime(item.status_updated_at || item.updated_at)}
                      </Typography>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          ) : (
            <Paper variant="outlined" sx={{ p: 1.1, borderRadius: 1.4 }}>
              <Typography variant="body2" color="text.secondary">
                暂无跟踪项。你在对话里同意“开启跟踪”后，这里会自动出现。
              </Typography>
            </Paper>
          )}
        </Box>
      </Dialog>

      {trackingSheet ? (
        <Paper
          variant="outlined"
          sx={{
            position: "fixed",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 112,
            zIndex: 1300,
            width: "min(760px, calc(100vw - 24px))",
            px: 1.1,
            py: 0.95,
            borderRadius: 2,
            borderColor: alpha(theme.palette.primary.main, 0.4),
            bgcolor: alpha(theme.palette.background.paper, 0.96),
            backdropFilter: "blur(10px)",
            boxShadow: "0 16px 32px rgba(0,0,0,0.16)",
            "@keyframes sheetIn": {
              from: { opacity: 0, transform: "translateX(-50%) translateY(8px)" },
              to: { opacity: 1, transform: "translateX(-50%) translateY(0)" },
            },
            animation: "sheetIn 180ms ease",
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={0.9} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between">
            <Stack direction="row" spacing={0.7} alignItems="center">
              <TrackChangesIcon sx={{ fontSize: 17, color: "primary.main" }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {trackingSheet.action.title || "是否开启持续跟踪？"}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.6} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" onClick={() => void handleTrackingChoice("track")}>
                跟踪 7 天
              </Button>
              <Button size="small" variant="outlined" onClick={() => void handleTrackingChoice("once")}>
                仅这次
              </Button>
              <Button size="small" color="inherit" onClick={() => void handleTrackingChoice("dismiss")}>
                不再提示
              </Button>
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Drawer
        anchor="right"
        open={citationDrawer.open}
        onClose={() => setCitationDrawer((prev) => ({ ...prev, open: false }))}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, p: 1.2 } }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.9 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            证据详情
          </Typography>
          <IconButton size="small" onClick={() => setCitationDrawer((prev) => ({ ...prev, open: false }))}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        {citationDrawer.citation ? (
          <Paper variant="outlined" sx={{ p: 0.9, borderRadius: 1.4, mb: 0.95 }}>
            <Typography variant="caption" color="text.secondary">
              {citationDrawer.citation.source_label} · {citationDrawer.citation.sender} · {citationDrawer.citation.received_at}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.35, fontWeight: 700, lineHeight: 1.4 }}>
              {citationDrawer.citation.title}
            </Typography>
          </Paper>
        ) : null}
        {citationDrawer.loading ? (
          <Stack direction="row" spacing={0.7} alignItems="center" sx={{ py: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              正在加载原文...
            </Typography>
          </Stack>
        ) : citationDrawer.error ? (
          <Typography variant="body2" color="error.main">
            {citationDrawer.error}
          </Typography>
        ) : (
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.62 }}>
            {citationDrawer.detail?.body || "暂无正文内容。"}
          </Typography>
        )}
        <Divider sx={{ my: 1 }} />
        <Stack direction="row" spacing={0.7}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const citation = citationDrawer.citation;
              if (!citation?.message_id) return;
              openDeskWithContext({
                messageId: citation.message_id,
                highlightSource: citation.source_label || citation.source,
                resumePrompt: `继续分析这条证据并给我后续建议：${citation.title}`,
              });
              setCitationDrawer((prev) => ({ ...prev, open: false }));
            }}
          >
            在 Desk 查看
          </Button>
          <Button
            size="small"
            variant="text"
            onClick={() => {
              const text = citationDrawer.detail?.body || citationDrawer.citation?.title || "";
              void copyText(text);
            }}
          >
            复制内容
          </Button>
        </Stack>
      </Drawer>
      {ConfirmDialog}
    </Box>
  );
}
