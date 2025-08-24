import React from 'react';

export default function ProgressBar({ percent, height = 14 }: { percent: number; height?: number }) {
  const p = Math.max(0, Math.min(100, percent || 0));
  return (
    <div className="progress" style={{ height }}>
      <div className="progress__bar" style={{ width: `${p}%` }} />
    </div>
  );
}


