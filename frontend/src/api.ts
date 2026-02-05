export type TokenResponse = { access_token: string; token_type: string };

export type User = {
  id: number;
  email: string;
  avatar_url?: string | null;
  created_at: string;
};

export type ConnectedAccount = {
  id: number;
  provider: string;
  identifier: string;
  last_synced_at?: string | null;
  created_at: string;
};

export type Contact = {
  id: number;
  display_name: string;
  handle: string;
  avatar_url?: string | null;
  last_message_at?: string | null;
  unread_count: number;
  latest_subject?: string | null;
  latest_preview?: string | null;
  latest_source?: string | null;
  latest_received_at?: string | null;
};

export type Message = {
  id: number;
  contact_id: number;
  source: string;
  sender: string;
  subject: string;
  body_preview: string;
  received_at: string;
  is_read: boolean;
  summary?: string | null;
};

export type MessageDetail = {
  id: number;
  contact_id: number;
  source: string;
  sender: string;
  subject: string;
  body: string;
  received_at: string;
  is_read: boolean;
  summary?: string | null;
};

const TOKEN_KEY = "mercurydesk_token";
let tokenCache: string | null | undefined;

export function getToken(): string | null {
  if (tokenCache === undefined) tokenCache = localStorage.getItem(TOKEN_KEY);
  return tokenCache;
}

export function setToken(token: string | null) {
  tokenCache = token;
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resp = await fetch(path, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new ApiError(text || `HTTP ${resp.status}`, resp.status);
  }
  return resp;
}

export async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resp = await apiFetch(path, init);
  return (await resp.json()) as T;
}

export async function register(email: string, password: string) {
  await fetchJson("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  return await fetchJson<TokenResponse>("/api/v1/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
}

export async function listAccounts(): Promise<ConnectedAccount[]> {
  return await fetchJson<ConnectedAccount[]>("/api/v1/accounts");
}

export async function createAccount(payload: {
  provider: string;
  identifier: string;
  access_token?: string | null;
  refresh_token?: string | null;
}): Promise<ConnectedAccount> {
  return await fetchJson<ConnectedAccount>("/api/v1/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteAccount(accountId: number): Promise<void> {
  await apiFetch(`/api/v1/accounts/${accountId}`, { method: "DELETE" });
}

export async function getProfile(): Promise<User> {
  return await fetchJson<User>("/api/v1/auth/me");
}

export async function updateProfile(payload: {
  email?: string;
  password?: string;
  avatar_url?: string;
}): Promise<User> {
  return await fetchJson<User>("/api/v1/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function syncAccount(accountId: number) {
  return await fetchJson<{ inserted: number; account_id: number }>(`/api/v1/accounts/${accountId}/sync`, {
    method: "POST"
  });
}

export async function listContacts(params?: { q?: string; limit?: number; offset?: number }): Promise<Contact[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.offset) qs.set("offset", String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return await fetchJson<Contact[]>(`/api/v1/contacts${suffix}`);
}

export async function listMessages(params: {
  contactId: number;
  limit?: number;
  before_id?: number;
}): Promise<Message[]> {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.before_id) qs.set("before_id", String(params.before_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return await fetchJson<Message[]>(`/api/v1/contacts/${params.contactId}/messages${suffix}`);
}

export async function getMessage(messageId: number): Promise<MessageDetail> {
  return await fetchJson<MessageDetail>(`/api/v1/messages/${messageId}`);
}

export async function markContactRead(contactId: number): Promise<{ marked: number; contact_id: number }> {
  return await fetchJson<{ marked: number; contact_id: number }>(`/api/v1/contacts/${contactId}/mark-read`, {
    method: "POST"
  });
}

export async function agentSummarize(text: string): Promise<{ summary: string }> {
  return await fetchJson<{ summary: string }>("/api/v1/agent/summarize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
}

export async function agentDraftReply(text: string, tone: string): Promise<{ draft: string }> {
  return await fetchJson<{ draft: string }>("/api/v1/agent/draft-reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, tone })
  });
}
