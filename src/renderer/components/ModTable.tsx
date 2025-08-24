import React from 'react';

export type Row = { filename: string; size?: number; checksum?: string; cachedOn?: string; status?: string; checked?: boolean };

export default function ModTable({ rows, onToggle }: { rows: Row[]; onToggle: (filename: string, checked: boolean) => void }) {
  return (
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Filename</th>
          <th>Size</th>
          <th>Cached on</th>
          <th>Checksum</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.filename}>
            <td><input type="checkbox" checked={!!r.checked} onChange={(e) => onToggle(r.filename, e.target.checked)} /></td>
            <td>{r.filename}</td>
            <td>{r.size ? (r.size / (1024 * 1024)).toFixed(2) + ' MB' : '-'}</td>
            <td>{r.cachedOn ? new Date(r.cachedOn).toLocaleString() : '-'}</td>
            <td>{r.checksum ? r.checksum.slice(0, 10) + '…' : '-'}</td>
            <td><span className="badge">{r.status || '—'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}


