import { useEffect, useMemo, useState } from "react";
import {
  Contact,
  ConnectedAccount,
  Message,
  createMockAccount,
  getMessage,
  listAccounts,
  listContacts,
  listMessages,
  syncAccount
} from "../api";

export default function Dashboard() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContactId, setActiveContactId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMessageId, setActiveMessageId] = useState<number | null>(null);
  const [activeBody, setActiveBody] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeContact = useMemo(
    () => contacts.find((c) => c.id === activeContactId) ?? null,
    [contacts, activeContactId]
  );
  const activeMessage = useMemo(() => messages.find((m) => m.id === activeMessageId) ?? null, [messages, activeMessageId]);

  async function refresh() {
    const [acct, cont] = await Promise.all([listAccounts(), listContacts()]);
    setAccounts(acct);
    setContacts(cont);
    if (activeContactId && !cont.some((c) => c.id === activeContactId)) {
      setActiveContactId(null);
      setMessages([]);
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeContactId) return;
    listMessages(activeContactId)
      .then((msgs) => {
        setMessages(msgs);
        setActiveMessageId(msgs[0]?.id ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [activeContactId]);

  useEffect(() => {
    if (!activeMessageId) {
      setActiveBody(null);
      return;
    }
    getMessage(activeMessageId)
      .then((detail) => setActiveBody(detail.body))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [activeMessageId]);

  async function ensureAndSyncDemo() {
    setBusy(true);
    setError(null);
    try {
      let acct = accounts.find((a) => a.provider === "mock") ?? null;
      if (!acct) {
        acct = await createMockAccount();
      }
      await syncAccount(acct.id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="row space-between">
          <div>
            <div style={{ fontWeight: 700 }}>Contacts</div>
            <div className="muted">{contacts.length} senders</div>
          </div>
          <button className="btn" onClick={ensureAndSyncDemo} disabled={busy}>
            Sync demo
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12 }} className="error">
            {error}
          </div>
        )}

        <div className="list">
          {contacts.map((c) => (
            <div
              key={c.id}
              className={`contact ${c.id === activeContactId ? "active" : ""}`}
              onClick={() => setActiveContactId(c.id)}
            >
              <div className="row space-between">
                <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.display_name}
                </div>
                {c.unread_count > 0 && <span className="badge">{c.unread_count}</span>}
              </div>
              <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.handle}
              </div>
            </div>
          ))}
          {contacts.length === 0 && (
            <div className="card">
              <div style={{ fontWeight: 650 }}>No messages yet</div>
              <div className="muted">Click “Sync demo” to pull mock messages into your inbox.</div>
            </div>
          )}
        </div>
      </div>

      <div className="main">
        <div className="row space-between" style={{ marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{activeContact ? activeContact.display_name : "Select a contact"}</div>
            <div className="muted">{activeContact ? activeContact.handle : "Sender-centric aggregated view"}</div>
          </div>
          <div className="muted">{accounts.length ? `${accounts.length} connected accounts` : "No connected accounts"}</div>
        </div>

        {activeContact && (
          <div className="card">
            <div className="row" style={{ gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 320 }}>
                <div style={{ fontWeight: 650, marginBottom: 8 }}>Messages</div>
                <div className="list">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`contact ${m.id === activeMessageId ? "active" : ""}`}
                      onClick={() => setActiveMessageId(m.id)}
                      style={{ borderRadius: 10 }}
                    >
                      <div className="row space-between">
                        <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.subject || "(no subject)"}
                        </div>
                        <span className="muted">{new Date(m.received_at).toLocaleString()}</span>
                      </div>
                      <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.summary ?? m.body_preview}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 650, marginBottom: 8 }}>Detail</div>
                {activeMessage ? (
                  <>
                    <div className="muted">
                      <span style={{ fontWeight: 650 }}>{activeMessage.source}</span> · {activeMessage.sender}
                    </div>
                    <h3 style={{ margin: "10px 0 6px" }}>{activeMessage.subject || "(no subject)"}</h3>
                    <div className="muted" style={{ marginBottom: 10 }}>
                      {activeMessage.summary ? `Summary: ${activeMessage.summary}` : "No summary yet"}
                    </div>
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{activeBody ?? "Loading..."}</pre>
                  </>
                ) : (
                  <div className="muted">Select a message.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

