import { ipcMain, shell, BrowserWindow, app } from 'electron';
import { getConfig, setModsPath, getDownloadsDir } from './state';
import { listCachedDownloads, insertDownloads, reinstallDownloads, syncDownloads } from './downloader';
import { scrapeMods } from './scraper';
import { openLogsFolder } from './logging';
import { getRunAtStartup, setRunAtStartup } from './startup';

export function registerIpcHandlers() {
  ipcMain.handle('config:get', async () => getConfig());
  ipcMain.handle('config:setModsPath', async (_e, p: string) => setModsPath(p));

  ipcMain.handle('startup:get', async () => getRunAtStartup());
  ipcMain.handle('startup:set', async (_e, enabled: boolean) => setRunAtStartup(enabled));

  ipcMain.handle('scrape:listMods', async () => scrapeMods());

  ipcMain.handle('download:sync', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) || undefined;
    let lastEmit = 0;
    await syncDownloads((progress) => {
      const now = Date.now();
      if (now - lastEmit < 120 && progress.transferred) return; // still allow initial 0% event
      lastEmit = now;
      win?.webContents.send('progress', progress);
    });
  });

  ipcMain.handle('downloads:list', async () => listCachedDownloads());
  ipcMain.handle('downloads:insert', async (_e, args: { filenames?: string[]; all?: boolean }) => insertDownloads(args));
  ipcMain.handle('downloads:reinstall', async (_e, args: { filenames: string[] }) => reinstallDownloads(args));

  ipcMain.handle('updater:check', async () => {
    const { checkForUpdates } = await import('./updater');
    return checkForUpdates();
  });
  ipcMain.handle('updater:updateNow', async () => {
    const { updateNow } = await import('./updater');
    return updateNow();
  });

  ipcMain.handle('logs:open', async () => openLogsFolder());
  ipcMain.handle('folder:open', async (_e, { which }: { which: 'downloads' | 'mods' }) => {
    if (which === 'downloads') return shell.openPath(getDownloadsDir());
    if (which === 'mods') return shell.openPath((await getConfig()).modsPath);
  });

  // Window controls
  ipcMain.handle('window:minimize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win?.minimize();
  });
  ipcMain.handle('window:toggleMaximize', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize(); else win.maximize();
  });
  ipcMain.handle('window:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    win?.close();
  });
}


