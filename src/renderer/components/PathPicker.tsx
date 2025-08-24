import React from 'react';

export default function PathPicker(props: { value: string; onChange: (v: string) => void; onOpen?: () => void }) {
  const { value, onChange, onOpen } = props;
  return (
    <div className="row" style={{ gap: 8 }}>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      <button onClick={onOpen}>Change…</button>
    </div>
  );
}


