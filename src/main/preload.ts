import { contextBridge, ipcRenderer } from 'electron';

export type IpcApi = {
  config: {
    get: () => Promise<{ modsPath: string; runAtStartup: boolean; lastChecked: string | null }>;
    setModsPath: (path: string) => Promise<void>;
  };
  startup: {
    get: () => Promise<boolean>;
    set: (enabled: boolean) => Promise<void>;
  };
  scrape: {
    listMods: () => Promise<Array<{ filename: string; url: string; size?: number }>>;
  };
  download: {
    sync: () => Promise<void>;
  };
  downloads: {
    list: () => Promise<any[]>;
    insert: (args: { filenames?: string[]; all?: boolean }) => Promise<void>;
    reinstall: (args: { filenames: string[] }) => Promise<void>;
  };
  updater: {
    check: () => Promise<{ updateAvailable: boolean; version?: string; notes?: string }>;
    updateNow: () => Promise<void>;
  };
  logs: {
    open: () => Promise<void>;
  };
  folder: {
    open: (which: 'downloads' | 'mods') => Promise<void>;
  };
  onProgress: (handler: (payload: any) => void) => void;
};

const api: IpcApi = {
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    setModsPath: (p) => ipcRenderer.invoke('config:setModsPath', p)
  },
  startup: {
    get: () => ipcRenderer.invoke('startup:get'),
    set: (enabled) => ipcRenderer.invoke('startup:set', enabled)
  },
  scrape: {
    listMods: () => ipcRenderer.invoke('scrape:listMods')
  },
  download: {
    sync: () => ipcRenderer.invoke('download:sync')
  },
  downloads: {
    list: () => ipcRenderer.invoke('downloads:list'),
    insert: (args) => ipcRenderer.invoke('downloads:insert', args),
    reinstall: (args) => ipcRenderer.invoke('downloads:reinstall', args)
  },
  updater: {
    check: () => ipcRenderer.invoke('updater:check'),
    updateNow: () => ipcRenderer.invoke('updater:updateNow')
  },
  logs: {
    open: () => ipcRenderer.invoke('logs:open')
  },
  folder: {
    open: (which) => ipcRenderer.invoke('folder:open', { which })
  },
  onProgress: (handler) => ipcRenderer.on('progress', (_e, payload) => handler(payload))
};

contextBridge.exposeInMainWorld('api', api);

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:toggleMaximize'),
  close: () => ipcRenderer.invoke('window:close')
});

declare global {
  interface Window {
    api: IpcApi;
  }
}


