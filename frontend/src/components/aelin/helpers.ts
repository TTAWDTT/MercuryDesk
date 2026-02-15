import type { AelinCitation } from "../../api";
import {
  AELIN_EXPRESSION_IDS,
  type AelinExpressionId,
  PLATFORM_ALIASES,
  type PlatformKey,
  TRACKING_STATUS_META,
} from "./constants";

export function normalizeProviderId(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePlatformName(raw: string): PlatformKey | null {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, "");
  if (!key) return null;
  return PLATFORM_ALIASES[key] || null;
}

export function formatTrackingStatus(raw: string): {
  label: string;
  color: "success" | "info" | "warning" | "error" | "default";
} {
  const key = (raw || "").trim().toLowerCase();
  return TRACKING_STATUS_META[key] || { label: raw || "未知", color: "default" };
}

export function normalizeAccountKey(raw: string): string {
  return raw.replace(/^@+/, "").trim().toLowerCase();
}

export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function initialsFromName(name: string): string {
  const normalized = name.replace(/^@+/, "").trim();
  if (!normalized) return "?";
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
  return (normalized[0] || "?").toUpperCase();
}

export function resolveCitationPlatform(item: AelinCitation): PlatformKey {
  const bySource = normalizePlatformName(item.source || "");
  if (bySource) return bySource;
  const byLabel = normalizePlatformName(item.source_label || "");
  if (byLabel) return byLabel;
  return "generic";
}

export function nextMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

export function formatIsoTime(raw: string | null | undefined) {
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

export function traceParallelLane(stage: string): string | null {
  const normalized = (stage || "").toLowerCase().trim();
  if (normalized.startsWith("web_search_subagent_")) return "reply_web";
  if (normalized.startsWith("local_search_subagent_")) return "reply_local";
  if (normalized.startsWith("trace_web_subagent_")) return "trace_web";
  if (normalized.startsWith("trace_local_subagent_")) return "trace_local";
  return null;
}

export function traceParallelLabel(lane: string): string {
  const map: Record<string, string> = {
    reply_web: "Reply/Web",
    reply_local: "Reply/Local",
    trace_web: "Trace/Web",
    trace_local: "Trace/Local",
  };
  return map[lane] || lane;
}

export function toolStepLabel(stage: string): string {
  const normalized = (stage || "").toLowerCase().trim();
  if (normalized.startsWith("web_search_subagent_")) {
    const idx = Number(normalized.split("web_search_subagent_")[1] || "");
    return Number.isFinite(idx) && idx > 0 ? `Reply Web Subagent ${idx}` : "Reply Web Subagent";
  }
  if (normalized.startsWith("local_search_subagent_")) {
    const idx = Number(normalized.split("local_search_subagent_")[1] || "");
    return Number.isFinite(idx) && idx > 0 ? `Reply Local Subagent ${idx}` : "Reply Local Subagent";
  }
  if (normalized.startsWith("trace_agent_prefetch_")) {
    const idx = Number(normalized.split("trace_agent_prefetch_")[1] || "");
    return Number.isFinite(idx) && idx > 0 ? `Trace Prefetch ${idx}` : "Trace Prefetch";
  }
  if (normalized.startsWith("trace_web_subagent_")) {
    const idx = Number(normalized.split("trace_web_subagent_")[1] || "");
    return Number.isFinite(idx) && idx > 0 ? `Trace Web Subagent ${idx}` : "Trace Web Subagent";
  }
  if (normalized.startsWith("trace_local_subagent_")) {
    const idx = Number(normalized.split("trace_local_subagent_")[1] || "");
    return Number.isFinite(idx) && idx > 0 ? `Trace Local Subagent ${idx}` : "Trace Local Subagent";
  }
  const map: Record<string, string> = {
    planner: "Planner",
    intent_lens: "Intent Lens",
    main_agent: "Main Agent",
    plan_critic: "Plan Critic",
    query_decomposer: "Query Decomposer",
    reply_agent: "Reply Agent",
    reply_dispatch: "Reply Dispatch",
    local_search: "Local Search",
    web_search: "Web Search",
    message_hub: "Message Hub",
    generation: "Generation",
    grounding_judge: "Grounding Judge",
    coverage_verifier: "Coverage Verifier",
    reply_verifier: "Reply Verifier",
    trace_agent: "Trace Agent",
    trace_dispatch: "Trace Dispatch",
  };
  return map[normalized] || stage;
}

export function looksLikeMarkdown(content: string): boolean {
  if (!content) return false;
  return (
    /(^|\n)\s*[-*+]\s+/.test(content) ||
    /(^|\n)\s*\d+\.\s+/.test(content) ||
    /(^|\n)\s*#{1,6}\s+/.test(content) ||
    /`[^`\n]+`/.test(content) ||
    /```[\s\S]*?```/.test(content) ||
    /\[[^\]]+\]\([^)]+\)/.test(content) ||
    /(^|\n)\s*>/.test(content)
  );
}

export function normalizeAutoLinksForMarkdown(content: string): string {
  if (!content) return content;
  const urlRegex = /(?<!\]\()((https?:\/\/|www\.)[^\s<]+)/gi;
  return content.replace(urlRegex, (raw) => {
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    return `[${raw}](${href})`;
  });
}

export function extractFirstUrl(text: string): string {
  if (!text) return "";
  const m = text.match(/(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/i);
  if (!m) return "";
  const raw = m[1] || "";
  return raw.startsWith("http") ? raw : `https://${raw}`;
}

export function normalizeExpressionId(raw: string | null | undefined): AelinExpressionId | undefined {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return undefined;
  if (AELIN_EXPRESSION_IDS.includes(text as AelinExpressionId)) return text as AelinExpressionId;
  if (/^exp[-_]\d{1,2}$/.test(text)) {
    const n = Number(text.replace("exp", "").replace("-", "").replace("_", ""));
    if (Number.isFinite(n) && n >= 1 && n <= 11) return `exp-${String(n).padStart(2, "0")}` as AelinExpressionId;
  }
  if (/^\d{1,2}$/.test(text)) {
    const n = Number(text);
    if (n >= 1 && n <= 11) return `exp-${String(n).padStart(2, "0")}` as AelinExpressionId;
  }
  return undefined;
}
