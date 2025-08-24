import { app, BrowserWindow, Tray, Notification } from 'electron';
import { setRunAtStartupFlag } from './state';
import { getLogger } from './logging';

const logger = getLogger();

export async function getRunAtStartup(): Promise<boolean> {
  // Electron provides this info on Windows
  const s = app.getLoginItemSettings();
  return !!s.openAtLogin;
}

export async function setRunAtStartup(enabled: boolean) {
  try {
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--auto-sync'] });
    await setRunAtStartupFlag(enabled);
  } catch (e: any) {
    logger.error(`setRunAtStartup failed: ${e?.message || e}`);
    throw e;
  }
}

export async function performAutoSyncIfRequested(mainWindow: BrowserWindow | null, tray: Tray | null) {
  if (!process.argv.includes('--auto-sync')) return;
  if (mainWindow) {
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
  }
  try {
    const { syncDownloads, insertDownloads } = await import('./downloader');
    await syncDownloads();
    await insertDownloads({ all: true });
    new Notification({ title: 'FS25 Mod Loader', body: 'Auto-sync complete' }).show();
    app.quit();
  } catch (e: any) {
    new Notification({ title: 'FS25 Mod Loader', body: 'Auto-sync failed. See logs.' }).show();
    // Keep app running in tray for user to inspect
  }
}


