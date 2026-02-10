export type OAuthPopupMessage = {
  source?: string;
  ok?: boolean;
  account_id?: number;
  identifier?: string;
  error?: string;
  provider?: string;
};

export type OAuthPopupResult = {
  ok: boolean;
  account_id?: number;
  identifier?: string;
  error?: string;
  provider?: string;
};

type WaitForOAuthPopupOptions = {
  allowedOrigin?: string | null;
  source?: string;
  timeoutMs?: number;
};

export function openOAuthPopup(name: string, loadingText: string): Window {
  const popup = window.open(
    "about:blank",
    name,
    "width=560,height=760,menubar=no,toolbar=no,status=no"
  );
  if (!popup) {
    throw new Error("浏览器拦截了授权弹窗，请允许弹窗后重试");
  }
  popup.document.title = "MercuryDesk OAuth";
  popup.document.body.innerHTML = `<p style="font-family:system-ui;padding:24px;">${loadingText}</p>`;
  return popup;
}

export function extractRedirectOriginFromAuthUrl(authUrl: string): string | null {
  try {
    const parsed = new URL(authUrl);
    const redirectUri = parsed.searchParams.get("redirect_uri");
    if (!redirectUri) return null;
    return new URL(redirectUri).origin;
  } catch {
    return null;
  }
}

export function waitForOAuthPopupMessage(
  popup: Window,
  options: WaitForOAuthPopupOptions = {}
): Promise<OAuthPopupResult> {
  const {
    allowedOrigin = null,
    source = "mercurydesk-oauth",
    timeoutMs = 180_000,
  } = options;

  return new Promise((resolve, reject) => {
    let settled = false;
    let onMessage: ((event: MessageEvent) => void) | null = null;

    const cleanup = () => {
      if (onMessage) {
        window.removeEventListener("message", onMessage);
      }
      window.clearInterval(watcher);
      window.clearTimeout(timeout);
    };

    const finish = (fn: (value: any) => void, value: any) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const timeout = window.setTimeout(() => {
      finish(reject, new Error("授权超时，请重试"));
    }, timeoutMs);

    const watcher = window.setInterval(() => {
      if (!popup.closed) return;
      window.setTimeout(() => {
        if (!settled) finish(reject, new Error("授权窗口已关闭"));
      }, 450);
    }, 500);

    onMessage = (event: MessageEvent) => {
      if (allowedOrigin && event.origin !== allowedOrigin) return;
      const data = (event.data || {}) as OAuthPopupMessage;
      if (data.source !== source) return;
      finish(resolve, {
        ok: !!data.ok,
        account_id: data.account_id,
        identifier: data.identifier,
        error: data.error,
        provider: data.provider,
      });
    };

    window.addEventListener("message", onMessage);
  });
}

