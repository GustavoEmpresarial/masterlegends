const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Wayland often presents a black webview. Paint through X11 instead.
app.disableHardwareAcceleration();
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  if (process.env.WAYLAND_DISPLAY) {
    app.commandLine.appendSwitch('ozone-platform', 'x11');
  }
}

const DEFAULT_BASE = process.env.MLL_BASE_URL || 'http://143.20.50.96';
const LIVE_PATH = '/club/stadium/live';

/** Only Stadium Live + auth — never the rest of the game. */
const ALLOWED_PATH_PREFIXES = [
  LIVE_PATH,
  '/login',
  '/register',
  '/auth/',
  '/verificar-email',
  '/esqueci-senha',
  '/recuperar-senha',
];

function baseOrigin() {
  return new URL(DEFAULT_BASE).origin;
}

function liveUrl() {
  const u = new URL(LIVE_PATH, DEFAULT_BASE.replace(/\/$/, '') + '/');
  u.searchParams.set('widget', '1');
  return u.toString();
}

function isAllowedUrl(raw) {
  if (typeof raw === 'string' && raw.startsWith('data:text/html')) return true;
  try {
    const u = new URL(raw);
    if (u.origin !== baseOrigin()) return false;
    const pathname = u.pathname.replace(/\/+$/, '') || '/';
    return ALLOWED_PATH_PREFIXES.some((prefix) => {
      const p = prefix.replace(/\/+$/, '') || '/';
      if (prefix.endsWith('/')) {
        return pathname === p || pathname.startsWith(prefix) || pathname.startsWith(`${p}/`);
      }
      return pathname === p || pathname.startsWith(`${p}/`);
    });
  } catch {
    return false;
  }
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

function resolveIcon() {
  const packaged = path.join(process.resourcesPath || '', 'icon.png');
  const dev = path.join(__dirname, '..', 'build', 'icon.png');
  try {
    fs.accessSync(packaged);
    return packaged;
  } catch {
    return dev;
  }
}

function isAuthorizeUrl(raw) {
  try {
    const u = new URL(raw);
    return u.origin === baseOrigin() && u.pathname.startsWith('/stadium-live/authorize');
  } catch {
    return false;
  }
}

function bounceToLive(wc) {
  const target = liveUrl();
  if (wc.getURL() !== target) {
    wc.loadURL(target);
  }
}

function attachStadiumLiveLock(wc) {
  wc.setWindowOpenHandler(({ url }) => {
    if (isAuthorizeUrl(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    // Never open game routes in a new window inside the shell.
    if (isAllowedUrl(url)) {
      wc.loadURL(url);
    }
    // External links (legal, etc.) stay out of this widget.
    return { action: 'deny' };
  });

  wc.on('will-navigate', (event, url) => {
    if (isAuthorizeUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
      return;
    }
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      bounceToLive(wc);
    }
  });

  wc.on('will-redirect', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
      bounceToLive(wc);
    }
  });

  // SPA client-side routing (React Router pushState)
  wc.on('did-navigate-in-page', (_event, url) => {
    if (!isAllowedUrl(url)) {
      bounceToLive(wc);
    }
  });

  wc.on('did-navigate', (_event, url) => {
    if (!isAllowedUrl(url)) {
      bounceToLive(wc);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 720,
    height: 480,
    minWidth: 420,
    minHeight: 280,
    title: 'MLL Stadium Live',
    backgroundColor: '#070b09',
    autoHideMenuBar: true,
    frame: false,
    thickFrame: true,
    alwaysOnTop: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:mll-stadium-live',
    },
    icon: resolveIcon(),
  });

  Menu.setApplicationMenu(null);
  attachStadiumLiveLock(mainWindow.webContents);
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _desc, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    const wc = mainWindow?.webContents;
    if (!wc) return;
    wc.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000;color:#a7f3d0;font-family:sans-serif;display:grid;place-items:center;height:100vh;text-align:center"><div><p>Não foi possível abrir o campo ao vivo.</p><p><a style="color:#34d399" href="' +
            liveUrl() +
            '">Tentar de novo</a></p></div></body>',
        ),
    );
  });
  mainWindow.loadURL(liveUrl());

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.handle('mll:open-external', (_event, url) => {
  if (typeof url === 'string' && (isAuthorizeUrl(url) || isAllowedUrl(url))) {
    return shell.openExternal(url);
  }
  return false;
});
ipcMain.handle('mll:get-live-url', () => liveUrl());
ipcMain.handle('mll:window-minimize', () => {
  mainWindow?.minimize();
});
ipcMain.handle('mll:window-toggle-maximize', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('mll:window-close', () => {
  mainWindow?.close();
});
ipcMain.handle('mll:toggle-always-on-top', () => {
  if (!mainWindow) return false;
  const next = !mainWindow.isAlwaysOnTop();
  mainWindow.setAlwaysOnTop(next, 'floating');
  return next;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
