import React, { useEffect, useState } from 'react';
import PathPicker from '../components/PathPicker';

export default function Settings() {
  const [runAtStartup, setRunAtStartup] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ updateAvailable: boolean; version?: string } | null>(null);

  useEffect(() => {
    window.api.startup.get().then(setRunAtStartup);
  }, []);

  async function toggleStartup() { await window.api.startup.set(!runAtStartup); setRunAtStartup(!runAtStartup); }
  async function checkUpdates() { const r = await window.api.updater.check(); setUpdateInfo(r); }
  async function updateNow() { await window.api.updater.updateNow(); }
  async function openDownloads() { await window.api.folder.open('downloads'); }
  async function openLogs() { await window.api.logs.open(); }

  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="card" style={{ display:'flex', gap: 8 }}>
        <div className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={runAtStartup} onChange={toggleStartup} />
          <div>
            <div style={{ fontWeight: 700 }}>Run at Startup</div>
            <div className="subtle" style={{ fontSize: 12 }}>
              When enabled, FS25 Mod Loader starts with Windows and performs an automatic sync in the background on boot.
            </div>
          </div>
        </div>
      </div>
      <div className="card">
        <div style={{ fontWeight: 700, marginBottom: 6 }}>About</div>
        <div className="subtle" style={{ fontSize: 13, lineHeight: 1.5 }}>
          FS25 Mod Loader is a simple, reliable desktop tool that keeps your Farming Simulator 2025 mods up to date with your server. It automatically downloads new or updated mods from the server, stores them in a local cache, and lets you insert them into your FS25 mods folder with one click. With built-in startup sync, a clean dashboard, and update support through GitHub, it ensures players always have the correct mods installed—without the hassle of manual downloads.
          <div style={{ marginTop: 8 }}>Made by <b>xx9</b></div>
        </div>
      </div>
      <div className="card row" style={{ gap: 8 }}>
        <button onClick={checkUpdates}>Check for updates</button>
        <button onClick={updateNow} disabled={!updateInfo?.updateAvailable}>Update now</button>
        {updateInfo && <div style={{ color:'var(--muted)' }}>{updateInfo.updateAvailable ? `Update available: v${updateInfo.version}` : 'Up-to-date'}</div>}
      </div>
      <div className="card row" style={{ gap: 8 }}>
        <button onClick={openDownloads}>Open Downloads folder</button>
        <button onClick={openLogs}>View Logs</button>
      </div>
    </div>
  );
}


