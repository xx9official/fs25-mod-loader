import fs from 'fs-extra';
import path from 'path';
import { createWriteStream } from 'fs';
import { net, Notification } from 'electron';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';
import { computeSha256, atomicCopy, filesAreDifferent } from './fileOps';
import { getCache, setCache, getDownloadsDir, setLastChecked } from './state';
import { scrapeMods } from './scraper';
import { getLogger } from './logging';

type ProgressHandler = (p: any) => void;

function createLimit(concurrency: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (activeCount >= concurrency) return;
    const run = queue.shift();
    if (!run) return;
    activeCount++;
    run();
  };
  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            activeCount--;
            next();
          });
      };
      queue.push(run);
      next();
    });
  };
}

const limit = createLimit(1);
const logger = getLogger();
const SIZE_TOLERANCE = 2048; // bytes

async function head(url: string) {
  const headers: Record<string, string> = { 'accept-encoding': 'identity', connection: 'close' };
  const tryHead = () => new Promise<{ etag?: string; lastModified?: string; contentLength?: number }>((resolve, reject) => {
    const request = net.request({ method: 'HEAD', url });
    Object.entries(headers).forEach(([k, v]) => request.setHeader(k, v));
    request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');
    request.setHeader('Referer', 'http://141.95.14.181:27047/mods.html?lang=en');
    request.setHeader('Accept', '*/*');
    request.on('response', (response) => {
      const h = response.headers as Record<string, string[]>;
      const etag = h['etag']?.[0];
      const lastModified = h['last-modified']?.[0];
      const contentLength = h['content-length']?.[0] ? Number(h['content-length'][0]) : undefined;
      resolve({ etag, lastModified, contentLength });
    });
    request.on('error', reject);
    request.end();
  });
  const tryRange = () => new Promise<{ etag?: string; lastModified?: string; contentLength?: number }>((resolve, reject) => {
    const request = net.request({ method: 'GET', url });
    request.setHeader('Range', 'bytes=0-0');
    Object.entries(headers).forEach(([k, v]) => request.setHeader(k, v));
    request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');
    request.setHeader('Referer', 'http://141.95.14.181:27047/mods.html?lang=en');
    request.setHeader('Accept', '*/*');
    request.on('response', (response) => {
      const h = response.headers as Record<string, string[]>;
      const etag = h['etag']?.[0];
      const lastModified = h['last-modified']?.[0];
      const cr = h['content-range']?.[0];
      const total = cr && /(\/\d+)$/.exec(cr)?.[1] ? Number(/\/(\d+)$/.exec(cr)![1]) : undefined;
      const contentLength = total || (h['content-length']?.[0] ? Number(h['content-length'][0]) : undefined);
      resolve({ etag, lastModified, contentLength });
    });
    request.on('error', reject);
    request.end();
  });
  try {
    return await tryHead();
  } catch {
    try {
      return await tryRange();
    } catch {
      return {} as any;
    }
  }
}

export async function listCachedDownloads() {
  const cache = await getCache();
  const dir = getDownloadsDir();
  const entries = await fs.readdir(dir);
  return await Promise.all(entries.filter(e => /\.(zip|zipx)$/i.test(e)).map(async (filename) => {
    const filePath = path.join(dir, filename);
    const stat = await fs.stat(filePath);
    const c = cache.mods[filename];
    return {
      filename,
      size: stat.size,
      checksum: c?.sha256 || (await computeSha256(filePath)),
      lastUpdated: c?.downloadedAt,
      presentInCache: true
    };
  }));
}

export async function shouldDownload(filename: string, url: string, meta?: { etag?: string; contentLength?: number }) {
  const downloadsDir = getDownloadsDir();
  const localPath = path.join(downloadsDir, filename);
  const exists = await fs.pathExists(localPath);
  const cache = await getCache();
  const cached = cache.mods[filename];

  if (!exists) return true;

  const stat = await fs.stat(localPath);
  try { logger.info(`shouldDownload: file=${filename} exists size=${stat.size} metaLen=${meta?.contentLength ?? 'n/a'}`); } catch {}

  // Seed cache from existing file if missing
  if (!cached) {
    try {
      const sha = await computeSha256(localPath);
      cache.mods[filename] = {
        sourceUrl: url,
        sha256: sha,
        size: stat.size,
        etag: meta?.etag,
        lastModified: undefined,
        downloadedAt: new Date().toISOString()
      };
      await setCache(cache);
    } catch {}
    // File exists locally; only download if server reports a valid, different size
    if (meta?.contentLength !== undefined) {
      const ml = meta.contentLength;
      if (ml < 1024) { try { logger.info(`shouldDownload: file=${filename} (seeded) metaLen too small (${ml}) -> skip`); } catch {}; return false; }
      const decision = Math.abs(ml - stat.size) > SIZE_TOLERANCE;
      try { logger.info(`shouldDownload: file=${filename} (seeded) metaLen=${ml} local=${stat.size} tol=${SIZE_TOLERANCE} download=${decision}`); } catch {}
      return decision;
    }
    try { logger.info(`shouldDownload: file=${filename} (seeded) no metaLen -> skip`); } catch {}
    return false;
  }

  // Ensure cache has SHA and size
  if (!cached.sha256) {
    try {
      cached.sha256 = await computeSha256(localPath);
      cached.size = stat.size;
      await setCache(cache);
    } catch {}
  }

  // Prefer size match to skip download; ignore tiny/invalid content-length
  if (meta?.contentLength !== undefined) {
    const ml = meta.contentLength;
    if (ml < 1024) { try { logger.info(`shouldDownload: file=${filename} metaLen too small (${ml}) -> skip`); } catch {}; return false; }
    const diff = Math.abs(ml - stat.size);
    const sameWithinTol = diff <= SIZE_TOLERANCE;
    try { logger.info(`shouldDownload: file=${filename} metaLen=${ml} local=${stat.size} diff=${diff} tol=${SIZE_TOLERANCE} sameWithinTol=${sameWithinTol}`); } catch {}
    if (sameWithinTol) return false;
    return true;
  }

  // No validation headers; assume up-to-date when file exists
  try { logger.info(`shouldDownload: file=${filename} no metaLen -> skip`); } catch {}
  return false;
}

async function downloadOne(mod: { filename: string; url: string; size?: number }, onProgress?: ProgressHandler) {
  const downloadsDir = getDownloadsDir();
  await fs.ensureDir(downloadsDir);
  const tempPath = path.join(downloadsDir, mod.filename + '.partial');
  const finalPath = path.join(downloadsDir, mod.filename);

  const meta = await head(mod.url);
  // Emit initial progress event so UI shows the file starting
  const initialTotal = (meta.contentLength && meta.contentLength > 0) ? meta.contentLength : (mod.size && mod.size > 0 ? mod.size : undefined);
  try { logger.info(`download start: ${mod.filename} initialTotal=${initialTotal ?? 'n/a'}`); } catch {}
  onProgress?.({ type: 'download', file: mod.filename, percent: 0, transferred: 0, total: initialTotal });
  if (!(await shouldDownload(mod.filename, mod.url, meta))) { try { logger.info(`download skip (up-to-date): ${mod.filename}`); } catch {}; return { skipped: true, filename: mod.filename };
  }

  const headers: Record<string, string> = { 'accept-encoding': 'identity', connection: 'close' };
  await fs.ensureDir(path.dirname(tempPath));
  const total = meta.contentLength || mod.size || 0;
  async function downloadWithNet() {
    await new Promise<void>((resolve, reject) => {
      const request = net.request({ method: 'GET', url: mod.url, redirect: 'follow' });
      Object.entries(headers).forEach(([k, v]) => request.setHeader(k, v));
      request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36');
      request.setHeader('Referer', 'http://141.95.14.181:27047/mods.html?lang=en');
      request.setHeader('Accept', '*/*');
      request.on('response', (response) => {
        const out = createWriteStream(tempPath);
        // If server sends HTML (error page) instead of binary, treat as error
        const ct = ((response.headers as any)['content-type']?.[0] || '').toLowerCase();
        if (ct.includes('text/html')) {
          response.resume();
          out.close();
          return reject(new Error('Invalid response content-type (HTML)'));
        }
        const headerLen = Number((response.headers as any)['content-length']?.[0] || 0);
        const totalLen = headerLen > 0 ? headerLen : (total || 0);
        try { logger.info(`response: ${mod.filename} headerLen=${headerLen || 'n/a'} totalLen=${totalLen || 'n/a'}`); } catch {}
        let transferred = 0;
        response.on('data', (chunk) => {
          transferred += chunk.length;
          onProgress?.({ type: 'download', file: mod.filename, percent: totalLen ? (transferred / totalLen) * 100 : undefined, transferred, total: totalLen || undefined });
        });
        pipeline(response, out).then(() => resolve()).catch((e) => { out.close(); reject(e); });
      });
      request.on('error', reject);
      request.end();
    });
  }

  async function downloadWithCurl() {
    const curlCmd = process.platform === 'win32' ? 'curl.exe' : 'curl';
    const args = [
      '-L', '--retry', '3', '--fail',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      '--referer', 'http://141.95.14.181:27047/mods.html?lang=en',
      '-o', tempPath,
      mod.url
    ];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(curlCmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(); else reject(new Error(`curl exited with code ${code}`));
      });
    });
  }

  try {
    await downloadWithNet();
  } catch {
    try { logger.info(`net failed, falling back to curl: ${mod.filename}`); } catch {}
    try { if (await fs.pathExists(tempPath)) { await fs.remove(tempPath); } } catch {}
    await downloadWithCurl();
  }
  const sha = await computeSha256(tempPath);
  await fs.move(tempPath, finalPath, { overwrite: true });
  const cache = await getCache();
  cache.mods[mod.filename] = { sourceUrl: mod.url, sha256: sha, size: await fs.stat(finalPath).then(s => s.size), etag: meta.etag, lastModified: meta.lastModified, downloadedAt: new Date().toISOString() };
  await setCache(cache);
  try { logger.info(`download complete: ${mod.filename}`); } catch {}
  return { filename: mod.filename, sha };
}

export async function syncDownloads(onProgress?: ProgressHandler) {
  const mods = await scrapeMods();
  if (!mods.length) {
    onProgress?.({ type: 'info', message: 'No mods found to sync' });
    await setLastChecked(new Date().toISOString());
    return;
  }
  try { logger.info(`sync: scraped=${mods.length}`); } catch {}
  // Preflight to decide which files to download and sizes
  const queue: Array<{ mod: { filename: string; url: string; size?: number }; size: number }> = [];
  let missingCount = 0;
  let updateCount = 0;
  for (const m of mods) {
    const downloadsDir = getDownloadsDir();
    const localPath = path.join(downloadsDir, m.filename);
    const exists = await fs.pathExists(localPath);
    if (!exists) {
      // Don't HEAD missing files to avoid slow/broken servers; use scraped size if any
      queue.push({ mod: m, size: m.size || 0 });
      try { logger.info(`queue missing: ${m.filename}`); } catch {}
      missingCount += 1;
      continue;
    }
    const meta = await head(m.url);
    if (await shouldDownload(m.filename, m.url, meta)) {
      queue.push({ mod: m, size: meta.contentLength || m.size || 0 });
      try { logger.info(`queue update: ${m.filename}`); } catch {}
      updateCount += 1;
    }
  }
  try { logger.info(`queue size: ${queue.length}`); } catch {}
  onProgress?.({ type: 'plan', toDownload: missingCount, toUpdate: updateCount, total: queue.length });
  const totalBytes = queue.reduce((acc, q) => acc + (q.size || 0), 0);
  let downloadedBytes = 0;
  let index = 0;
  let errorCount = 0;
  for (const item of queue) {
    index += 1;
    let lastTransferred = 0;
    try {
      await downloadOne(item.mod, (p) => {
        const fileTotal = p.total || item.size || 0;
        const transferred = Math.max(0, p.transferred || 0);
        lastTransferred = transferred;
        const aggregateTransferred = downloadedBytes + lastTransferred;
        onProgress?.({
          type: 'download',
          file: item.mod.filename,
          percent: fileTotal ? (transferred / fileTotal) * 100 : p.percent,
          transferred,
          total: fileTotal || undefined,
          aggregate: {
            transferred: aggregateTransferred,
            total: totalBytes || undefined,
            remaining: totalBytes ? Math.max(0, totalBytes - aggregateTransferred) : undefined,
            fileIndex: index,
            numFiles: queue.length
          }
        });
      });
    } catch (e: any) {
      errorCount += 1;
      try { logger.info(`download error: ${item.mod.filename} -> ${(e && e.message) || e}`); } catch {}
      onProgress?.({ type: 'error', file: item.mod.filename, message: (e && e.message) || String(e) });
    }
    downloadedBytes += Math.max(lastTransferred, item.size || 0);
  }
  await setLastChecked(new Date().toISOString());
  try {
    new Notification({ title: 'FS25 Mod Loader', body: 'Downloads finished' }).show();
  } catch {}
}

export async function insertDownloads(args: { filenames?: string[]; all?: boolean }) {
  const downloadsDir = getDownloadsDir();
  const cache = await getCache();
  const targetFiles = args.all
    ? Object.keys(cache.mods)
    : (args.filenames || []);
  const { getConfig } = await import('./state');
  const { modsPath } = await getConfig();
  await fs.ensureDir(modsPath);
  for (const filename of targetFiles) {
    const src = path.join(downloadsDir, filename);
    const dest = path.join(modsPath, filename);
    if (await filesAreDifferent(src, dest)) {
      await atomicCopy(src, dest);
    }
  }
}

export async function reinstallDownloads(args: { filenames: string[] }) {
  const cache = await getCache();
  for (const filename of args.filenames) {
    const entry = cache.mods[filename];
    if (!entry) continue;
    // Force re-download by clearing cache metadata
    delete cache.mods[filename];
    await setCache(cache);
    await downloadOne({ filename, url: entry.sourceUrl });
  }
  const { modsPath } = await (await import('./state')).getConfig();
  const downloadsDir = getDownloadsDir();
  for (const filename of args.filenames) {
    const src = path.join(downloadsDir, filename);
    const dest = path.join(modsPath, filename);
    await atomicCopy(src, dest);
  }
}


