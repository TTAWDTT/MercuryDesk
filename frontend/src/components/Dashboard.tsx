import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import {
  Contact,
  ConnectedAccount,
  MessageDetail,
  agentDraftReply,
  agentSummarize,
  createAccount,
  fetchJson,
  markContactRead,
  Message,
  syncAccount
} from "../api";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import ToastStack, { Toast } from "./ToastStack";

const PAGE_SIZE = 30;

function toastId() {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

const ContactRow = memo(function ContactRow(props: {
  contact: Contact;
  active: boolean;
  onSelect: (id: number) => void;
}) {
  const c = props.contact;
  return (
    <button
      type="button"
      className={`contact vlist-item ${props.active ? "active" : ""}`}
      onClick={() => props.onSelect(c.id)}
    >
      <div className="row space-between" style={{ gap: 10 }}>
        <div className="ellipsis" style={{ fontWeight: 650 }}>
          {c.display_name}
        </div>
        {c.unread_count > 0 ? <span className="badge">{c.unread_count}</span> : <span className="dot" />}
      </div>
      <div className="muted ellipsis">{c.latest_preview ?? c.handle}</div>
      <div className="meta">
        <span className="pill">{c.latest_source ?? "—"}</span>
        <span className="muted">{formatWhen(c.latest_received_at ?? c.last_message_at)}</span>
      </div>
    </button>
  );
});

const MessageRow = memo(function MessageRow(props: {
  message: Message;
  active: boolean;
  onSelect: (id: number) => void;
}) {
  const m = props.message;
  return (
    <button
      type="button"
      className={`message vlist-item ${props.active ? "active" : ""} ${m.is_read ? "" : "unread"}`}
      onClick={() => props.onSelect(m.id)}
    >
      <div className="row space-between" style={{ gap: 12 }}>
        <div className="ellipsis" style={{ fontWeight: 650 }}>
          {m.subject || "(no subject)"}
        </div>
        <span className="muted mono">{new Date(m.received_at).toLocaleString()}</span>
      </div>
      <div className="muted ellipsis">{m.summary ?? m.body_preview}</div>
    </button>
  );
});

export default function Dashboard(props: { onLogout: () => void }) {
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<number | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [draft, setDraft] = useState("");
  const [draftTone, setDraftTone] = useState<"friendly" | "formal">("friendly");
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentSummary, setAgentSummary] = useState<string | null>(null);

  const [syncBusy, setSyncBusy] = useState(false);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [newProvider, setNewProvider] = useState<"mock" | "github">("mock");
  const [newIdentifier, setNewIdentifier] = useState("");
  const [newToken, setNewToken] = useState("");
  const [addAccountBusy, setAddAccountBusy] = useState(false);

  const pushToast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    setToasts((prev) => [...prev.slice(-2), { id: toastId(), message, kind }]);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  const debouncedQuery = useDebouncedValue(contactQuery.trim(), 220);
  const contactsKey = useMemo(() => {
    const qs = new URLSearchParams();
    if (debouncedQuery) qs.set("q", debouncedQuery);
    qs.set("limit", "200");
    return `/api/v1/contacts?${qs.toString()}`;
  }, [debouncedQuery]);

  const accounts = useSWR<ConnectedAccount[]>("/api/v1/accounts");
  const contacts = useSWR<Contact[]>(contactsKey);

  const visibleContacts = useMemo(() => {
    const list = contacts.data ?? [];
    return unreadOnly ? list.filter((c) => c.unread_count > 0) : list;
  }, [contacts.data, unreadOnly]);

  const activeContact = useMemo(
    () => (contacts.data ?? []).find((c) => c.id === activeContactId) ?? null,
    [contacts.data, activeContactId]
  );

  useEffect(() => {
    if (visibleContacts.length === 0) {
      setActiveContactId(null);
      return;
    }
    if (activeContactId && visibleContacts.some((c) => c.id === activeContactId)) return;
    setActiveContactId(visibleContacts[0].id);
  }, [activeContactId, visibleContacts]);

  const messages = useSWRInfinite<Message[]>(
    (pageIndex, previousPage) => {
      if (!activeContactId) return null;
      if (previousPage && previousPage.length === 0) return null;

      const qs = new URLSearchParams();
      qs.set("limit", String(PAGE_SIZE));
      if (pageIndex > 0 && previousPage && previousPage.length > 0) {
        qs.set("before_id", String(previousPage[previousPage.length - 1].id));
      }
      return `/api/v1/contacts/${activeContactId}/messages?${qs.toString()}`;
    },
    { revalidateFirstPage: false, persistSize: true }
  );

  const flatMessages = useMemo(() => (messages.data ? messages.data.flat() : []), [messages.data]);
  const isMessagesLoading = !messages.data && !messages.error;
  const isReachingEnd = Boolean(messages.data && messages.data[messages.data.length - 1]?.length < PAGE_SIZE);

  useEffect(() => {
    if (flatMessages.length === 0) {
      setActiveMessageId(null);
      return;
    }
    if (activeMessageId && flatMessages.some((m) => m.id === activeMessageId)) return;
    setActiveMessageId(flatMessages[0].id);
  }, [activeMessageId, flatMessages]);

  const messageDetail = useSWR<MessageDetail>(
    activeMessageId ? `/api/v1/messages/${activeMessageId}` : null,
    fetchJson
  );

  const lastMarkedContactRef = useRef<number | null>(null);
  useEffect(() => {
    if (!activeContactId) return;
    if (!contacts.data) return;
    const c = contacts.data.find((x) => x.id === activeContactId);
    if (!c || c.unread_count <= 0) return;
    if (lastMarkedContactRef.current === activeContactId) return;
    lastMarkedContactRef.current = activeContactId;

    void markContactRead(activeContactId)
      .then(() =>
        Promise.all([
          contacts.mutate(
            (prev) => prev?.map((x) => (x.id === activeContactId ? { ...x, unread_count: 0 } : x)),
            { revalidate: false }
          ),
          messages.mutate((prev) => prev?.map((page) => page.map((m) => ({ ...m, is_read: true }))), {
            revalidate: false
          })
        ])
      )
      .catch(() => {
        // ignore; best-effort UX
      });
  }, [activeContactId, contacts, messages]);

  const onSelectContact = useCallback((id: number) => {
    setActiveContactId(id);
    setActiveMessageId(null);
    setDraft("");
    setAgentSummary(null);
  }, []);

  const onSelectMessage = useCallback((id: number) => {
    setActiveMessageId(id);
    setDraft("");
    setAgentSummary(null);
  }, []);

  const onSyncDemo = useCallback(async () => {
    if (syncBusy) return;
    setSyncBusy(true);
    try {
      const list = accounts.data ?? [];
      const existingMock = list.find((a) => a.provider === "mock");
      const acct =
        existingMock ??
        (await createAccount({
          provider: "mock",
          identifier: "demo",
          access_token: "x"
        }));
      const result = await syncAccount(acct.id);
      pushToast(`Synced: +${result.inserted}`, "success");
      await Promise.all([accounts.mutate(), contacts.mutate(), messages.mutate()]);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSyncBusy(false);
    }
  }, [accounts, contacts, messages, pushToast, syncBusy]);

  const onAddAccount = useCallback(async () => {
    if (addAccountBusy) return;
    setAddAccountBusy(true);
    try {
      const identifier = (newIdentifier || "").trim() || (newProvider === "mock" ? "demo" : "me");
      const accessToken =
        newProvider === "mock" ? "x" : (newToken || "").trim() ? (newToken || "").trim() : null;
      if (newProvider !== "mock" && !accessToken) {
        pushToast("GitHub token required", "error");
        return;
      }
      const acct = await createAccount({ provider: newProvider, identifier, access_token: accessToken });
      pushToast(`Account added: ${acct.provider}`, "success");
      setAddAccountOpen(false);
      setNewIdentifier("");
      setNewToken("");
      await accounts.mutate();
    } catch (e) {
      pushToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setAddAccountBusy(false);
    }
  }, [accounts, addAccountBusy, newIdentifier, newProvider, newToken, pushToast]);

  const onLoadMore = useCallback(() => {
    void messages.setSize(messages.size + 1);
  }, [messages]);

  const onGenerateDraft = useCallback(async () => {
    if (!messageDetail.data) return;
    setAgentBusy(true);
    try {
      const resp = await agentDraftReply(messageDetail.data.body, draftTone);
      setDraft(resp.draft);
      pushToast("Draft ready", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setAgentBusy(false);
    }
  }, [draftTone, messageDetail.data, pushToast]);

  const onSummarize = useCallback(async () => {
    if (!messageDetail.data) return;
    setAgentBusy(true);
    try {
      const resp = await agentSummarize(messageDetail.data.body);
      setAgentSummary(resp.summary);
      pushToast("Summary refreshed", "success");
    } catch (e) {
      pushToast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setAgentBusy(false);
    }
  }, [messageDetail.data, pushToast]);

  const onCopyDraft = useCallback(async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
      pushToast("Copied", "success");
    } catch {
      pushToast("Copy failed", "error");
    }
  }, [draft, pushToast]);

  return (
    <div className="desk">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div>
            <div className="brand-name">MercuryDesk</div>
            <div className="muted">sender-centric inbox · agent-assisted</div>
          </div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn primary" onClick={onSyncDemo} disabled={syncBusy}>
            {syncBusy ? "Syncing…" : "Sync"}
          </button>
          <button className="btn" onClick={() => props.onLogout()}>
            Logout
          </button>
        </div>
      </div>

      <div className="desk-shell">
        <aside className="sidebar">
          <div className="card subtle">
            <div className="row space-between">
              <div>
                <div style={{ fontWeight: 700 }}>Contacts</div>
                <div className="muted">
                  {contacts.data ? `${visibleContacts.length} senders` : "Loading..."}
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => setUnreadOnly(e.target.checked)}
                />
                <span>Unread</span>
              </label>
            </div>
            <div style={{ marginTop: 10 }}>
              <input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search senders…"
              />
            </div>
          </div>

          <div className="list">
            {visibleContacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                active={c.id === activeContactId}
                onSelect={onSelectContact}
              />
            ))}

            {!contacts.error && contacts.data && visibleContacts.length === 0 && (
              <div className="card">
                <div style={{ fontWeight: 650 }}>No messages yet</div>
                <div className="muted">
                  Click <span className="kbd">Sync</span> to pull mock messages.
                </div>
              </div>
            )}

            {contacts.error && (
              <div className="card danger">
                <div style={{ fontWeight: 650 }}>Contacts error</div>
                <div className="muted">{contacts.error.message}</div>
              </div>
            )}
          </div>

          <div className="card subtle" style={{ marginTop: 12 }}>
            <div className="row space-between">
              <div style={{ fontWeight: 700 }}>Accounts</div>
              <div className="row" style={{ gap: 10 }}>
                <button className="btn" onClick={() => setAddAccountOpen((v) => !v)}>
                  {addAccountOpen ? "Close" : "Add"}
                </button>
                <div className="muted">{accounts.data ? accounts.data.length : "—"}</div>
              </div>
            </div>
            <div className="list" style={{ marginTop: 10 }}>
              {(accounts.data ?? []).map((a) => (
                <div key={a.id} className="account">
                  <div className="row space-between" style={{ gap: 12 }}>
                    <div className="ellipsis">
                      <span className="pill">{a.provider}</span> <span className="mono">{a.identifier}</span>
                      <div className="muted mono" style={{ marginTop: 2 }}>
                        last: {formatWhen(a.last_synced_at) || "never"}
                      </div>
                    </div>
                    <button
                      className="btn"
                      onClick={async () => {
                        try {
                          const r = await syncAccount(a.id);
                          pushToast(`Synced ${a.provider}: +${r.inserted}`, "success");
                          await Promise.all([accounts.mutate(), contacts.mutate(), messages.mutate()]);
                        } catch (e) {
                          pushToast(e instanceof Error ? e.message : String(e), "error");
                        }
                      }}
                    >
                      Sync
                    </button>
                  </div>
                </div>
              ))}

              {accounts.error && <div className="muted">Accounts error: {accounts.error.message}</div>}
              {!accounts.error && accounts.data && accounts.data.length === 0 && (
                <div className="muted">No connected accounts yet.</div>
              )}
            </div>

            {addAccountOpen && (
              <div className="card subtle" style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Add account</div>
                <div className="grid" style={{ gap: 10 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <select
                      className="select"
                      value={newProvider}
                      onChange={(e) => setNewProvider(e.target.value === "github" ? "github" : "mock")}
                    >
                      <option value="mock">mock</option>
                      <option value="github">github</option>
                    </select>
                    <input
                      value={newIdentifier}
                      onChange={(e) => setNewIdentifier(e.target.value)}
                      placeholder="identifier (email/username)"
                    />
                  </div>

                  {newProvider === "github" && (
                    <div>
                      <label>GitHub token</label>
                      <input
                        value={newToken}
                        onChange={(e) => setNewToken(e.target.value)}
                        placeholder="ghp_…"
                      />
                    </div>
                  )}

                  <div className="row" style={{ gap: 10 }}>
                    <button className="btn primary" onClick={onAddAccount} disabled={addAccountBusy}>
                      Add account
                    </button>
                    <div className="muted mono">Tokens are stored server-side (optionally encrypted).</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="main">
          <div className="row space-between" style={{ marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>
                {activeContact ? activeContact.display_name : "Select a contact"}
              </div>
              <div className="muted mono">{activeContact ? activeContact.handle : "sender-centric aggregated view"}</div>
            </div>
            <div className="muted mono">
              {activeContact?.unread_count ? `${activeContact.unread_count} unread` : " "}
            </div>
          </div>

          <div className="grid cols-2">
            <section className="card">
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Messages</div>
                <div className="muted mono">
                  {messages.isValidating ? "updating…" : flatMessages.length ? `${flatMessages.length}` : ""}
                </div>
              </div>

              {isMessagesLoading && <div className="muted">Loading…</div>}
              {messages.error && <div className="muted">Messages error: {messages.error.message}</div>}

              <div className="list">
                {flatMessages.map((m) => (
                  <MessageRow
                    key={m.id}
                    message={m}
                    active={m.id === activeMessageId}
                    onSelect={onSelectMessage}
                  />
                ))}
              </div>

              {!isReachingEnd && flatMessages.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <button className="btn" onClick={onLoadMore} disabled={messages.isValidating}>
                    Load more
                  </button>
                </div>
              )}
            </section>

            <section className="card">
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>Detail</div>
                <div className="row" style={{ gap: 10 }}>
                  <button className="btn" disabled={agentBusy || !messageDetail.data} onClick={onSummarize}>
                    Summarize
                  </button>
                  <button className="btn primary" disabled={agentBusy || !messageDetail.data} onClick={onGenerateDraft}>
                    Draft reply
                  </button>
                </div>
              </div>

              {!activeMessageId && <div className="muted">Select a message.</div>}
              {messageDetail.error && <div className="muted">Detail error: {messageDetail.error.message}</div>}
              {messageDetail.data && (
                <>
                  <div className="meta" style={{ marginBottom: 8 }}>
                    <span className="pill">{messageDetail.data.source}</span>
                    <span className="mono ellipsis">{messageDetail.data.sender}</span>
                    <span className="muted mono">{new Date(messageDetail.data.received_at).toLocaleString()}</span>
                  </div>

                  <h2 className="h2">{messageDetail.data.subject || "(no subject)"}</h2>

                  <div className="card subtle" style={{ marginTop: 10 }}>
                    <div className="row space-between">
                      <div style={{ fontWeight: 700 }}>Summary</div>
                      <span className="muted mono">agent</span>
                    </div>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {agentSummary ?? messageDetail.data.summary ?? "No summary yet"}
                    </div>
                  </div>

                  <div className="card subtle" style={{ marginTop: 10 }}>
                    <div className="row space-between">
                      <div style={{ fontWeight: 700 }}>Draft</div>
                      <div className="row" style={{ gap: 10 }}>
                        <select
                          className="select"
                          value={draftTone}
                          onChange={(e) => setDraftTone(e.target.value === "formal" ? "formal" : "friendly")}
                        >
                          <option value="friendly">friendly</option>
                          <option value="formal">formal</option>
                        </select>
                        <button className="btn" onClick={onCopyDraft} disabled={!draft}>
                          Copy
                        </button>
                      </div>
                    </div>
                    <textarea
                      className="textarea"
                      placeholder="Generate a draft reply with the Agent…"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={6}
                    />
                  </div>

                  <div className="card subtle" style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Body</div>
                    <pre className="pre">{messageDetail.data.body}</pre>
                  </div>
                </>
              )}
            </section>
          </div>
        </main>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
