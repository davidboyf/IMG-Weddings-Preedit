import { contextBridge, ipcRenderer } from 'electron'

// Type-safe API exposed to renderer
const api = {
  // File dialogs
  openFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
  saveFile: (opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', opts),
  openProject: (): Promise<string | null> => ipcRenderer.invoke('dialog:openProject'),

  // File system
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', filePath),
  scanFolder: (folderPath: string): Promise<string[]> =>
    ipcRenderer.invoke('fs:scanFolder', folderPath),
  showInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openPath', filePath),

  // FFprobe
  getVideoInfo: (filePath: string): Promise<VideoInfo> =>
    ipcRenderer.invoke('ffprobe:info', filePath),

  // FFmpeg
  getThumbnail: (filePath: string, timeSeconds: number): Promise<string | null> =>
    ipcRenderer.invoke('ffmpeg:thumbnail', filePath, timeSeconds),
  getWaveform: (filePath: string, numSamples: number): Promise<number[]> =>
    ipcRenderer.invoke('ffmpeg:waveform', filePath, numSamples),
  extractAudio: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('ffmpeg:extractAudio', filePath),

  // Menu events (main → renderer)
  onMenu: (event: string, callback: () => void) => {
    ipcRenderer.on(`menu:${event}`, callback)
    return () => ipcRenderer.removeListener(`menu:${event}`, callback)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

// ──────────────────────────────────────────────
// Type declarations (for TypeScript in renderer)
// ──────────────────────────────────────────────
export interface VideoInfo {
  duration: number
  size: number
  bitrate: number
  codec: string
  width: number
  height: number
  fps: number
  audioCodec: string | null
  audioChannels: number
  audioSampleRate: number
  createdAt: string | null
}

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
