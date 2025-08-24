import { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, shell } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import { registerIpcHandlers } from './ipc.js';
import { getLogger } from './logging.js';
import { ensureAppStateInitialized } from './state.js';
import { performAutoSyncIfRequested } from './startup.js';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const isDev = !!process.env.VITE_DEV_SERVER_URL;

function getIconPath() {
  const resourcesDir = app.isPackaged ? process.resourcesPath : process.cwd();
  const primary = path.join(resourcesDir, 'resources', 'fd.ico');
  const fallback = path.join(resourcesDir, 'resources', 'icon.ico');
  return fs.existsSync(primary) ? primary : fallback;
}

async function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    backgroundColor: '#0b0f14',
    show: false,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: getIconPath()
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  const url = isDev ? process.env.VITE_DEV_SERVER_URL! : `file://${path.join(process.resourcesPath, 'dist/renderer/index.html')}`;
  await mainWindow.loadURL(url);

  // In dev, explicitly set the taskbar icon after load to help Windows pick it up
  try {
    if (isDev) {
      const ni = nativeImage.createFromPath(getIconPath());
      if (!ni.isEmpty() && (mainWindow as any).setIcon) {
        (mainWindow as any).setIcon(ni);
      }
    }
  } catch {}

  mainWindow.on('close', () => { mainWindow = null; });
}

function createTray() {
  const iconImage = nativeImage.createFromPath(getIconPath());
  tray = new Tray(iconImage);
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Sync now', click: () => { mainWindow?.webContents.send('app:traySync'); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);
  tray.setToolTip('FS25 Mod Loader');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  // Ensure Windows taskbar grouping/notifications use our app id and icon (packaged)
  try { app.setAppUserModelId('com.yourorg.fs25modloader'); } catch {}
  getLogger();
  await ensureAppStateInitialized();
  await createWindow();
  createTray();
  registerIpcHandlers();
  await performAutoSyncIfRequested(mainWindow, tray);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


