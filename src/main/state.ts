import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { app } from 'electron';

export type Config = {
  modsPath: string;
  runAtStartup: boolean;
  lastChecked: string | null;
};

type CacheEntry = {
  sourceUrl: string;
  sha256?: string;
  size?: number;
  etag?: string;
  lastModified?: string;
  downloadedAt?: string;
};

export type Cache = {
  mods: Record<string, CacheEntry>;
};

export function getAppDataDir() {
  const dir = path.join(app.getPath('appData'), 'FS25ModLoader');
  fs.ensureDirSync(dir);
  return dir;
}

export function getDownloadsDir() {
  const exeDir = app.isPackaged ? path.dirname(app.getPath('exe')) : path.join(process.cwd());
  const dir = path.join(exeDir, 'Downloads');
  fs.ensureDirSync(dir);
  return dir;
}

const defaultModsPath = path.join(os.homedir(), 'Documents', 'My Games', 'FarmingSimulator2025', 'mods');

const CONFIG_PATH = () => path.join(getAppDataDir(), 'config.json');
const CACHE_PATH = () => path.join(getAppDataDir(), 'cache.json');

export async function ensureAppStateInitialized() {
  if (!(await fs.pathExists(CONFIG_PATH()))) {
    const initial: Config = {
      modsPath: defaultModsPath,
      runAtStartup: false,
      lastChecked: null
    };
    await fs.writeJson(CONFIG_PATH(), initial, { spaces: 2 });
  }
  if (!(await fs.pathExists(CACHE_PATH()))) {
    const initial: Cache = { mods: {} };
    await fs.writeJson(CACHE_PATH(), initial, { spaces: 2 });
  }
}

export async function getConfig(): Promise<Config> {
  await ensureAppStateInitialized();
  return fs.readJson(CONFIG_PATH());
}

export async function setModsPath(p: string) {
  const cfg = await getConfig();
  cfg.modsPath = p;
  await fs.writeJson(CONFIG_PATH(), cfg, { spaces: 2 });
}

export async function setRunAtStartupFlag(enabled: boolean) {
  const cfg = await getConfig();
  cfg.runAtStartup = enabled;
  await fs.writeJson(CONFIG_PATH(), cfg, { spaces: 2 });
}

export async function setLastChecked(dateIso: string | null) {
  const cfg = await getConfig();
  cfg.lastChecked = dateIso;
  await fs.writeJson(CONFIG_PATH(), cfg, { spaces: 2 });
}

export async function getCache(): Promise<Cache> {
  await ensureAppStateInitialized();
  return fs.readJson(CACHE_PATH());
}

export async function setCache(cache: Cache) {
  await fs.writeJson(CACHE_PATH(), cache, { spaces: 2 });
}


