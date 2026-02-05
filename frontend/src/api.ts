export type TokenResponse = { access_token: string; token_type: string };

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

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token);
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const resp = await fetch(path, { ...init, headers });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return resp;
}

export async function register(email: string, password: string) {
  await apiFetch("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);
  const resp = await apiFetch("/api/v1/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  return (await resp.json()) as TokenResponse;
}

export async function listAccounts(): Promise<ConnectedAccount[]> {
  const resp = await apiFetch("/api/v1/accounts");
  return (await resp.json()) as ConnectedAccount[];
}

export async function createMockAccount(): Promise<ConnectedAccount> {
  const resp = await apiFetch("/api/v1/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "mock", identifier: "demo", access_token: "x" })
  });
  return (await resp.json()) as ConnectedAccount;
}

export async function syncAccount(accountId: number) {
  const resp = await apiFetch(`/api/v1/accounts/${accountId}/sync`, { method: "POST" });
  return (await resp.json()) as { inserted: number; account_id: number };
}

export async function listContacts(): Promise<Contact[]> {
  const resp = await apiFetch("/api/v1/contacts");
  return (await resp.json()) as Contact[];
}

export async function listMessages(contactId: number): Promise<Message[]> {
  const resp = await apiFetch(`/api/v1/contacts/${contactId}/messages`);
  return (await resp.json()) as Message[];
}

export async function getMessage(messageId: number): Promise<MessageDetail> {
  const resp = await apiFetch(`/api/v1/messages/${messageId}`);
  return (await resp.json()) as MessageDetail;
}

