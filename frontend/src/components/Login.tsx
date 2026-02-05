import { useMemo, useState } from "react";
import { ApiError, login, register, setToken } from "../api";

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
      if (e instanceof ApiError && e.status === 401) setError("账号或密码错误");
      else setError(e instanceof Error ? e.message : String(e));
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
      if (e instanceof ApiError && e.status === 400) setError("该邮箱已注册");
      else setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-title">
          <div className="logo">
            <span className="logo-dot" />
            <span className="logo-dot" />
            <span className="logo-dot" />
          </div>
          <div>
            <h1>MercuryDesk</h1>
            <p className="muted">统一信息聚合 · 发信人视角 · 智能摘要（MVP）</p>
          </div>
        </div>

        <div className="grid" style={{ gap: 12 }}>
          <div>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div>
            <label>Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn primary" disabled={!canSubmit} onClick={onLogin}>
            Login
          </button>
          <button className="btn" disabled={!canSubmit} onClick={onRegisterAndLogin}>
            Register + Login
          </button>
        </div>

        <div className="auth-hint muted">
          提示：先注册后点击 <span className="kbd">Sync</span> 拉取 mock 消息。
        </div>
      </div>
    </div>
  );
}
