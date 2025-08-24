import React, { useEffect, useMemo, useState } from 'react';
import Splash from './screens/Splash';
import Dashboard from './screens/Dashboard';
import Downloads from './screens/Downloads';
import Settings from './screens/Settings';
const { ipcRenderer } = (window as any).require ? (window as any) : { ipcRenderer: undefined };

type Tab = 'dashboard' | 'downloads' | 'settings';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(t);
  }, []);

  if (showSplash) return <Splash />;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="toolbar" style={{ padding: 12, WebkitAppRegion: 'drag' as any }}>
        <div className="topbrand">
          <div style={{ width: 10, height: 10, borderRadius: 2, background: 'linear-gradient(135deg, var(--brand), var(--brand2))' }} />
          <div>FS25 Mod Loader</div>
        </div>
        <div style={{ flex: 1 }} />
        <div className="tabs" style={{ WebkitAppRegion: 'no-drag' as any }}>
          <button className={`tab ${tab==='dashboard'?'tab--active':''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={`tab ${tab==='downloads'?'tab--active':''}`} onClick={() => setTab('downloads')}>Downloads</button>
          <button className={`tab ${tab==='settings'?'tab--active':''}`} onClick={() => setTab('settings')}>Settings</button>
        </div>
        <div style={{ width: 12 }} />
        <div className="row" style={{ gap: 8, WebkitAppRegion: 'no-drag' as any }}>
          <button className="winbtn winbtn--min" onClick={() => (window as any).electronAPI?.minimize?.()} title="Minimize">–</button>
          <button className="winbtn winbtn--max" onClick={() => (window as any).electronAPI?.maximize?.()} title="Maximize">□</button>
          <button className="winbtn winbtn--close" onClick={() => (window as any).electronAPI?.close?.()} title="Close">×</button>
        </div>
      </div>
      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'downloads' && <Downloads />}
        {tab === 'settings' && <Settings />}
      </div>
    </div>
  );
}


