import { useMemo, useState } from "react";
import { login, register, setToken } from "../api";

export default function Login(props: { onAuthed: () => void }) {
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("password123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => email.length > 3 && password.length >= 8 && !busy, [email, password, busy]);

  async function onLogin() {
    setBusy(true);
    setError(null);
    try {
      const token = await login(email, password);
      setToken(token.access_token);
      props.onAuthed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onRegisterAndLogin() {
    setBusy(true);
    setError(null);
    try {
      await register(email, password);
      await onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "10vh auto" }} className="card">
      <h2 style={{ marginTop: 0 }}>MercuryDesk</h2>
      <p className="muted">统一信息聚合与智能摘要（MVP）</p>

      <div style={{ marginTop: 12 }}>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div style={{ marginTop: 12 }}>
        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div style={{ marginTop: 12 }} className="error">
          {error}
        </div>
      )}

      <div style={{ marginTop: 14 }} className="row">
        <button className="btn" disabled={!canSubmit} onClick={onLogin}>
          Login
        </button>
        <button className="btn" disabled={!canSubmit} onClick={onRegisterAndLogin}>
          Register + Login
        </button>
      </div>

      <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
        提示：此示例默认使用后端的 mock 连接器进行演示。
      </p>
    </div>
  );
}

