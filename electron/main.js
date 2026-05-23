const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn, execFile } = require("child_process");
const path = require("path");
const isDev = require("electron-is-dev");
const http = require("http");
const { exec } = require("child_process");

let mainWindow;
let backendProcess;
const DEEP_LINK_PROTOCOL = "nautilus";
const pendingDeepLinks = [];
const DEV_BACKEND_PORT = 8010;

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
}

function extractDeepLink(argv = []) {
  return argv.find((value) =>
    typeof value === "string" &&
    value.startsWith(`${DEEP_LINK_PROTOCOL}://`)
  ) ?? null;
}

function dispatchDeepLink(url) {
  if (!url) return;

  if (!mainWindow?.webContents) {
    pendingDeepLinks.push(url);
    return;
  }

  const send = () => {
    mainWindow?.webContents.send("deep-link-url", url);
  };

  if (mainWindow.webContents.isLoadingMainFrame()) {
    mainWindow.webContents.once("did-finish-load", send);
    return;
  }

  send();
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout);
    });
  });
}

async function getMacNowPlaying() {
  if (process.platform !== "darwin") {
    return {
      source: "electron",
      is_playing: false,
      progress_ms: null,
      duration_ms: null,
      timestamp: null,
      track: null,
      device: { name: "Desktop", type: process.platform },
    };
  }

  const scripts = [
    {
      source: "Spotify",
      script: `
tell application "Spotify"
  if it is running then
    set track_name to name of current track
    set artist_name to artist of current track
    set album_name to album of current track
    set player_state to player state as text
    set duration_value to duration of current track
    set position_value to player position
    return "Spotify | " & track_name & " | " & artist_name & " | " & album_name & " | " & player_state & " | " & (duration_value as text) & " | " & (position_value as text)
  end if
end tell
return ""
`,
    },
    {
      source: "Music",
      script: `
tell application "Music"
  if it is running then
    set player_state to player state as text
    if player_state is "stopped" then return ""
    set track_name to name of current track
    set artist_name to artist of current track
    set album_name to album of current track
    set duration_value to duration of current track
    set position_value to player position
    return "Music | " & track_name & " | " & artist_name & " | " & album_name & " | " & player_state & " | " & (duration_value as text) & " | " & (position_value as text)
  end if
end tell
return ""
`,
    },
  ];

  try {
    let raw = "";

    for (const item of scripts) {
      try {
        raw = await execFileAsync("osascript", ["-e", item.script]);
        console.log(`[now-playing] raw osascript (${item.source}):`, JSON.stringify(raw));
        if (raw.trim()) {
          break;
        }
      } catch (error) {
        console.error(`[now-playing] osascript failed (${item.source}):`, error);
      }
    }

    if (!raw.trim()) {
      console.log("[now-playing] no active desktop player payload");
      return {
        source: "electron",
        is_playing: false,
        progress_ms: null,
        duration_ms: null,
        timestamp: null,
        track: null,
        device: { name: "Mac", type: "macOS" },
      };
    }

    const parts = raw.trim().split(" | ");
    console.log("[now-playing] parsed parts:", parts);
    if (parts.length < 7) {
      console.log("[now-playing] insufficient parts");
      return {
        source: "electron",
        is_playing: false,
        progress_ms: null,
        duration_ms: null,
        timestamp: null,
        track: null,
        device: { name: "Mac", type: "macOS" },
      };
    }

    const [source, name, artist, album, state, rawDuration, rawPosition] = parts;
    const durationNumber = Number(rawDuration);
    const positionNumber = Number(rawPosition);
    const durationMs = durationNumber > 0
      ? (durationNumber > 1000 ? Math.round(durationNumber) : Math.round(durationNumber * 1000))
      : null;
    const progressMs = positionNumber >= 0 ? Math.round(positionNumber * 1000) : null;

    return {
      source,
      is_playing: state === "playing",
      progress_ms: progressMs,
      duration_ms: durationMs,
      timestamp: Date.now(),
      track: {
        id: null,
        uri: null,
        name,
        artists: artist ? [artist] : [],
        album: album || null,
        image_url: null,
        external_url: null,
        isrc: null,
      },
      device: {
        name: "Mac",
        type: source,
      },
    };
  } catch (error) {
    console.error("[now-playing] unexpected now-playing failure:", error);
    return {
      source: "electron",
      is_playing: false,
      progress_ms: null,
      duration_ms: null,
      timestamp: null,
      track: null,
      device: { name: "Mac", type: "macOS" },
    };
  }
}

function killPort(port) {
  return new Promise((resolve) => {
    const cmd =
      process.platform === "win32"
        ? `netstat -ano | findstr :${port}`
        : `lsof -ti:${port}`;

    exec(cmd, (err, stdout) => {
      if (err || !stdout.trim()) return resolve(); // 이미 비어있음

      const pid = process.platform === "win32"
        ? stdout.trim().split(/\s+/).pop()
        : stdout.trim();

      const killCmd =
        process.platform === "win32"
          ? `taskkill /PID ${pid} /F`
          : `kill -9 ${pid}`;

      exec(killCmd, () => resolve());
    });
  });
}

// ─── FastAPI 서버 실행 ───────────────────────────────────────
async function startBackend() {

  await killPort(DEV_BACKEND_PORT);

  // 개발: 시스템 python / 배포: 번들된 실행파일
  const isPackaged = app.isPackaged;

  let backendExecutable;
  let backendCwd = path.join(__dirname, "..", "backend");

  if (isPackaged) {
    backendExecutable = path.join(
      process.resourcesPath,
      "backend",
      process.platform === "win32" ? "main.exe" : "main"
    );
    backendCwd = path.join(process.resourcesPath, "backend");
  } else {
    // venv 안의 python으로 uvicorn 모듈을 직접 실행한다.
    // `venv/bin/uvicorn`은 경로 변경 후 shebang이 깨질 수 있다.
    backendExecutable = path.join(
      __dirname, "..", "backend", "venv", "bin", "python"
    );
  }

  const args = isPackaged
    ? []
    : ["-m", "uvicorn", "main:app", "--reload", "--port", String(DEV_BACKEND_PORT), "--host", "0.0.0.0"];

  backendProcess = spawn(backendExecutable, args, {
    cwd: backendCwd,
    stdio: "pipe",
  });

  backendProcess.stdout.on("data", (data) => {
    console.log(`[FastAPI] ${data}`);
  });

  backendProcess.stderr.on("data", (data) => {
    console.error(`[FastAPI ERR] ${data}`);
  });

  backendProcess.on("exit", (code) => {
    console.log(`[FastAPI] exit code: ${code}`);
  });
}

// ─── FastAPI 준비될 때까지 대기 ──────────────────────────────
function waitForBackend(url, retries = 20, delay = 500) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      http
        .get(url, (res) => {
          if (res.statusCode < 500) resolve();
          else if (n > 0) setTimeout(() => check(n - 1), delay);
          else reject(new Error("Backend 응답 없음"));
        })
        .on("error", () => {
          if (n > 0) setTimeout(() => check(n - 1), delay);
          else reject(new Error("Backend 연결 실패"));
        });
    };
    check(retries);
  });
}

// ─── BrowserWindow 생성 ──────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    vibrancy: 'fullscreen-ui',
    backgroundMaterial: 'acrylic',
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 14, y: 14 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 개발: Vite dev server / 배포: FastAPI가 서빙하는 dist
  const startUrl = isDev
    ? "http://localhost:5173"
    : `http://localhost:${DEV_BACKEND_PORT}`;

  mainWindow.loadURL(startUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);

    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on("did-finish-load", () => {
    while (pendingDeepLinks.length > 0) {
      const url = pendingDeepLinks.shift();
      if (url) {
        mainWindow?.webContents.send("deep-link-url", url);
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── 앱 라이프사이클 ─────────────────────────────────────────
app.on("open-url", (event, url) => {
  event.preventDefault();
  dispatchDeepLink(url);
});

app.on("second-instance", (_event, argv) => {
  const url = extractDeepLink(argv);

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  }

  dispatchDeepLink(url);
});

app.whenReady().then(async () => {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      DEEP_LINK_PROTOCOL,
      process.execPath,
      [path.resolve(process.argv[1])]
    );
  } else {
    app.setAsDefaultProtocolClient(DEEP_LINK_PROTOCOL);
  }

  await startBackend();

  try {
    await waitForBackend(`http://localhost:${DEV_BACKEND_PORT}/docs`);
  } catch (e) {
    dialog.showErrorBox(
      "Backend 오류",
      "FastAPI 서버를 시작할 수 없습니다.\nPython 환경을 확인하세요."
    );
  }

  createWindow();

  ipcMain.handle("now-playing:get", async () => getMacNowPlaying());

  dispatchDeepLink(extractDeepLink(process.argv));

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  if (process.platform === "darwin") {
    app.dock.setIcon(path.join(__dirname, "../electron/resources/icon.png"));

  }
  
});

app.on("window-all-closed", () => {
  // FastAPI 프로세스 종료
  if (backendProcess) {
    backendProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});
