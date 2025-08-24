import React from 'react';

export default function Splash() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection:'column', gap:18 }}>
      <div className="splash-logo">FS25 Mod Loader</div>
      <div className="splash-loader" />
      <div style={{ color: 'var(--muted)', display:'flex', alignItems:'center', gap:8 }}>
        <div className="splash-pulse" />
        <div>Loading…</div>
      </div>
    </div>
  );
}


