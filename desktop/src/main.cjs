const { app, BrowserWindow, dialog } = require("electron");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const isDev = process.env.MERCURYDESK_DESKTOP_DEV === "1" || !app.isPackaged;
const backendPort = Number(process.env.MERCURYDESK_BACKEND_PORT || (isDev ? 8000 : 18080));
const frontendPort = Number(process.env.MERCURYDESK_DESKTOP_PORT || (isDev ? 5173 : 1420));

let mainWindow = null;
let backendProc = null;
let frontendDevProc = null;
let frontendServer = null;
let closing = false;

function projectRoot() {
  return path.resolve(__dirname, "..", "..");
}

function backendDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "backend") : path.join(projectRoot(), "backend");
}

function frontendDir() {
  return path.join(projectRoot(), "frontend");
}

function frontendDistDir() {
  return app.isPackaged ? path.join(process.resourcesPath, "frontend-dist") : path.join(frontendDir(), "dist");
}

function sqliteUrl(absPath) {
  return `sqlite:///${String(absPath || "").replace(/\\/g, "/")}`;
}

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      const code = Number(res.statusCode || 0);
      res.resume();
      resolve(code >= 200 && code < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    if (await requestOk(url)) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function killProcTree(proc) {
  if (!proc || proc.killed) return;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(proc.pid), "/t", "/f"], { windowsHide: true });
    killer.on("error", () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore kill errors
      }
    });
    return;
  }
  try {
    proc.kill("SIGTERM");
  } catch {
    // ignore kill errors
  }
}

function spawnViaCmd(commandLine, options) {
  const comspec = process.env.COMSPEC || "cmd.exe";
  return spawn(comspec, ["/d", "/s", "/c", commandLine], options);
}

function startBackend() {
  const root = backendDir();
  if (!fs.existsSync(root)) {
    throw new Error(`backend 目录不存在: ${root}`);
  }

  const userData = app.getPath("userData");
  const mediaDir = path.join(userData, "media");
  fs.mkdirSync(mediaDir, { recursive: true });
  const dbFile = path.join(userData, "mercurydesk.db");

  const env = {
    ...process.env,
    PYTHONUTF8: "1",
    MERCURYDESK_DATABASE_URL: sqliteUrl(dbFile),
    MERCURYDESK_MEDIA_DIR: mediaDir,
    MERCURYDESK_CORS_ORIGINS: [
      `http://127.0.0.1:${frontendPort}`,
      `http://localhost:${frontendPort}`,
      "http://127.0.0.1:5173",
      "http://localhost:5173",
    ].join(","),
  };

  const requestedPython = String(process.env.MERCURYDESK_PYTHON || "").trim();
  const pythonCandidates = [];
  if (requestedPython) pythonCandidates.push(`"${requestedPython}"`);
  pythonCandidates.push("py -3", "python");

  let started = false;
  let lastError = "";
  for (const runner of pythonCandidates) {
    try {
      const cmd = `${runner} -m uvicorn app.main:app --host 127.0.0.1 --port ${backendPort}`;
      backendProc = spawnViaCmd(cmd, {
        cwd: root,
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      started = true;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  if (!started || !backendProc) {
    throw new Error(`无法启动后端 Python 进程。${lastError ? `最后错误: ${lastError}` : ""}`);
  }

  backendProc.stdout.on("data", (chunk) => {
    process.stdout.write(`[backend] ${String(chunk)}`);
  });
  backendProc.stderr.on("data", (chunk) => {
    process.stderr.write(`[backend] ${String(chunk)}`);
  });
  backendProc.on("error", (err) => {
    if (closing) return;
    dialog.showErrorBox("后端启动失败", String(err?.message || err));
  });
}

function startFrontendDev() {
  if (process.env.MERCURYDESK_DESKTOP_SKIP_FRONTEND_DEV === "1") return;
  const cmd = `npm run dev -- --host 127.0.0.1 --port ${frontendPort}`;
  frontendDevProc = spawnViaCmd(cmd, {
    cwd: frontendDir(),
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      BROWSER: "none",
    },
  });
  frontendDevProc.stdout.on("data", (chunk) => {
    process.stdout.write(`[frontend] ${String(chunk)}`);
  });
  frontendDevProc.stderr.on("data", (chunk) => {
    process.stderr.write(`[frontend] ${String(chunk)}`);
  });
}

function startFrontendServer() {
  const dist = frontendDistDir();
  if (!fs.existsSync(dist)) {
    throw new Error(`frontend dist 不存在: ${dist}，请先执行桌面构建流程中的前端 build。`);
  }

  const web = express();
  web.use("/api", createProxyMiddleware({ target: `http://127.0.0.1:${backendPort}`, changeOrigin: true }));
  web.use("/media", createProxyMiddleware({ target: `http://127.0.0.1:${backendPort}`, changeOrigin: true }));
  web.use(express.static(dist));
  web.get("*", (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });

  frontendServer = web.listen(frontendPort, "127.0.0.1");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1160,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#111111",
    title: "Aelin",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const url = `http://127.0.0.1:${frontendPort}`;
  mainWindow.loadURL(url);
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function boot() {
  startBackend();
  const backendReady = await waitForUrl(`http://127.0.0.1:${backendPort}/healthz`, 60000);
  if (!backendReady) {
    throw new Error("后端服务启动超时，请检查 Python 环境与依赖。");
  }

  if (isDev) {
    startFrontendDev();
  } else {
    startFrontendServer();
  }

  const frontendReady = await waitForUrl(`http://127.0.0.1:${frontendPort}`, 60000);
  if (!frontendReady) {
    throw new Error("前端服务启动超时。");
  }
}

function cleanup() {
  closing = true;
  if (frontendServer) {
    try {
      frontendServer.close();
    } catch {
      // ignore close errors
    }
    frontendServer = null;
  }
  killProcTree(frontendDevProc);
  killProcTree(backendProc);
  frontendDevProc = null;
  backendProc = null;
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  cleanup();
});

app.whenReady().then(async () => {
  try {
    await boot();
    createMainWindow();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dialog.showErrorBox("Aelin Desktop 启动失败", message);
    cleanup();
    app.quit();
  }
});
