import React, { useEffect, useState } from 'react';
import ModTable, { Row } from '../components/ModTable';

export default function Downloads() {
  const [rows, setRows] = useState<Row[]>([]);

  async function refresh() {
    const items = await window.api.downloads.list();
    const mapped: Row[] = items.map((i: any) => ({ filename: i.filename, size: i.size, checksum: i.checksum, cachedOn: i.lastUpdated, status: 'Up-to-date', checked: false }));
    setRows(mapped);
  }

  useEffect(() => { refresh(); }, []);

  function toggle(filename: string, checked: boolean) {
    setRows((r) => r.map((x) => (x.filename === filename ? { ...x, checked } : x)));
  }

  async function insertSelected() {
    const selected = rows.filter(r => r.checked).map(r => r.filename);
    await window.api.downloads.insert({ filenames: selected });
    await refresh();
  }

  async function insertAll() {
    await window.api.downloads.insert({ all: true });
    await refresh();
  }

  async function reinstallSelected() {
    const selected = rows.filter(r => r.checked).map(r => r.filename);
    await window.api.downloads.reinstall({ filenames: selected });
    await refresh();
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="toolbar">
        <button onClick={insertAll}>Insert all</button>
        <button onClick={insertSelected} disabled={!rows.some(r => r.checked)}>Insert selected</button>
        <button onClick={reinstallSelected} disabled={!rows.some(r => r.checked)}>Reinstall selected</button>
        <div style={{ flex: 1 }} />
        <button onClick={refresh}>Refresh</button>
      </div>
      <div className="card">
        <ModTable rows={rows} onToggle={toggle} />
      </div>
    </div>
  );
}


