import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog } from 'electron';
import { getLogger } from './logging';

const logger = getLogger();

autoUpdater.logger = console;
autoUpdater.autoDownload = false;

export async function checkForUpdates() {
  try {
    const result = await autoUpdater.checkForUpdates();
    const updateAvailable = !!result?.updateInfo && result.updateInfo.version !== app.getVersion();
    return { updateAvailable, version: result?.updateInfo?.version, notes: (result as any)?.updateInfo?.releaseNotes };
  } catch (e: any) {
    logger.error(`checkForUpdates error: ${e?.message || e}`);
    return { updateAvailable: false };
  }
}

export async function updateNow() {
  try {
    await autoUpdater.downloadUpdate();
    await autoUpdater.quitAndInstall(false, true);
  } catch (e: any) {
    logger.error(`updateNow error: ${e?.message || e}`);
    throw e;
  }
}


