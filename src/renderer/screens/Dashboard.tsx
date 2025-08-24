import React, { useEffect, useMemo, useRef, useState } from 'react';
import PathPicker from '../components/PathPicker';
import ProgressBar from '../components/ProgressBar';

export default function Dashboard() {
  const [modsPath, setModsPath] = useState('');
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ file?: string; percent?: number; transferred?: number; total?: number } | null>(null);
  const [displayProgress, setDisplayProgress] = useState<{ file?: string; percent?: number; transferred?: number; total?: number; fileIndex?: number; numFiles?: number }>({});
  const displayedFileRef = useRef<string | undefined>(undefined);
  const lastSwitchAtRef = useRef<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<{ toDownload: number; toUpdate: number; errors: number }>({ toDownload: 0, toUpdate: 0, errors: 0 });

  useEffect(() => {
    window.api.config.get().then((c) => { setModsPath(c.modsPath); setLastChecked(c.lastChecked); });
    const handler = (p: any) => {
      if (p?.type === 'plan') {
        setStatus(s => ({ ...s, toDownload: p.toDownload || 0, toUpdate: p.toUpdate || 0 }));
      } else if (p?.type === 'error') {
        setStatus(s => ({ ...s, errors: (s.errors || 0) + 1 }));
      }
      setProgress({ file: p.file, percent: p.percent, transferred: p.transferred, total: p.total });
      const now = Date.now();
      const currentDisplayed = displayedFileRef.current;
      const incomingFile = p.file as string | undefined;
      if (!currentDisplayed) {
        displayedFileRef.current = incomingFile;
        lastSwitchAtRef.current = now;
        setDisplayProgress({ file: incomingFile, percent: p.percent, transferred: p.transferred, total: p.total, fileIndex: p.aggregate?.fileIndex, numFiles: p.aggregate?.numFiles });
        return;
      }
      if (incomingFile && incomingFile !== currentDisplayed) {
        if (now - lastSwitchAtRef.current < 400) {
          // Too soon to switch displayed file; ignore to reduce flicker
          return;
        }
        displayedFileRef.current = incomingFile;
        lastSwitchAtRef.current = now;
      }
      setDisplayProgress({ file: displayedFileRef.current || incomingFile, percent: p.percent, transferred: p.transferred, total: p.total, fileIndex: p.aggregate?.fileIndex, numFiles: p.aggregate?.numFiles });
    };
    window.api.onProgress(handler);
  }, []);

  async function savePath() {
    await window.api.config.setModsPath(modsPath);
  }

  async function sync() {
    setError(null);
    setProgress({ percent: 0 });
    setIsSyncing(true);
    try {
      await window.api.download.sync();
    } catch (e: any) {
      setError(e?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="col" style={{ gap: 16 }}>
      {error && (
        <div className="card" style={{ borderColor: '#7f1d1d' }}>
          <div style={{ color: '#ef4444' }}>{error}</div>
        </div>
      )}

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="col" style={{ flex: 1 }}>
            <div className="h1" style={{ marginBottom: 6 }}>Mods destination</div>
            <PathPicker value={modsPath} onChange={setModsPath} onOpen={savePath} />
            <div className="subtle" style={{ marginTop: 8, fontSize: 12 }}>Last checked: {lastChecked ? new Date(lastChecked).toLocaleString() : '—'}</div>
          </div>
          <div className="col" style={{ minWidth: 240, justifyContent:'flex-end' }}>
            <button onClick={sync} style={{ height: 48, opacity: isSyncing ? .7 : 1 }} disabled={isSyncing}> {isSyncing ? 'Syncing…' : 'Sync now'} </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="h1" style={{ marginBottom: 6 }}>Status</div>
        <div className="row" style={{ gap: 24 }}>
          <div>Files to download: <b>{status.toDownload}</b></div>
          <div>Files to update: <b>{status.toUpdate}</b></div>
          <div>Errors: <b>{status.errors}</b></div>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent:'space-between', marginBottom: 8 }}>
          <div className="h1">Download progress</div>
          <div className="subtle" style={{ fontSize: 12 }}>{displayProgress.fileIndex ? `File ${displayProgress.fileIndex} of ${displayProgress.numFiles}` : ''}</div>
        </div>
        <div style={{ marginBottom: 8 }}>Current: <b>{displayProgress.file || progress?.file || '—'}</b></div>
        <ProgressBar height={16} percent={displayProgress.percent ?? progress?.percent ?? 0} />
        {(() => {
          const transferred = Math.max(0, displayProgress.transferred || 0);
          const totalRaw = displayProgress.total;
          const totalValid = totalRaw && totalRaw > 0 && totalRaw >= transferred ? totalRaw : undefined;
          return (
            <div style={{ marginTop: 10, display:'flex', justifyContent:'space-between', fontSize:12 }} className="subtle">
              <div>
                {totalValid
                  ? `${(transferred / (1024*1024)).toFixed(2)} MB / ${(totalValid / (1024*1024)).toFixed(2)} MB`
                  : `${(transferred / (1024*1024)).toFixed(2)} MB`}
              </div>
              <div>
                {totalValid
                  ? `Remaining ${(((totalValid - transferred)) / (1024*1024)).toFixed(2)} MB`
                  : ''}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}


