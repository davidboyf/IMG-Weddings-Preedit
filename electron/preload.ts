import { contextBridge, ipcRenderer } from 'electron'

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

const api = {
  // File dialogs
  openFiles: (): Promise<string[]> => ipcRenderer.invoke('dialog:openFiles'),
  openFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:openFolder'),
  saveFile: (opts: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', opts),
  openProject: (): Promise<string | null> => ipcRenderer.invoke('dialog:openProject'),
  openDirectory: (opts?: { defaultPath?: string }): Promise<string | null> =>
    ipcRenderer.invoke('dialog:openDirectory', opts ?? {}),

  // File system
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('fs:readFile', filePath),
  scanFolder: (folderPath: string): Promise<string[]> =>
    ipcRenderer.invoke('fs:scanFolder', folderPath),
  showInFinder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('shell:openPath', filePath),

  // Key-value store (recent projects, prefs)
  storeGet: (key: string): Promise<any> => ipcRenderer.invoke('store:get', key),
  storeSet: (key: string, value: any): Promise<boolean> => ipcRenderer.invoke('store:set', key, value),

  // FFprobe
  getVideoInfo: (filePath: string): Promise<VideoInfo> =>
    ipcRenderer.invoke('ffprobe:info', filePath),

  // FFmpeg
  getThumbnail: (filePath: string, timeSeconds: number): Promise<string | null> =>
    ipcRenderer.invoke('ffmpeg:thumbnail', filePath, timeSeconds),
  getWaveform: (filePath: string, numSamples: number): Promise<number[]> =>
    ipcRenderer.invoke('ffmpeg:waveform', filePath, numSamples),

  // FFmpeg: export trimmed clip
  exportClip: (
    filePath: string,
    outPath: string,
    inPoint: number,
    outPoint: number,
    useProxy?: boolean
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('ffmpeg:exportClip', filePath, outPath, inPoint, outPoint, useProxy ?? false),

  // FFmpeg: create proxy
  createProxy: (
    clipId: string,
    filePath: string,
    outputDir: string
  ): Promise<{ success: boolean; proxyPath?: string; error?: string }> =>
    ipcRenderer.invoke('ffmpeg:createProxy', clipId, filePath, outputDir),

  // Menu events (main → renderer)
  onMenu: (event: string, callback: () => void) => {
    ipcRenderer.on(`menu:${event}`, callback)
    return () => ipcRenderer.removeListener(`menu:${event}`, callback)
  },

  // Proxy progress events
  onProxyProgress: (callback: (data: { clipId: string; elapsed: number }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('proxy:progress', handler)
    return () => ipcRenderer.removeListener('proxy:progress', handler)
  },

  // Audio
  openAudio: (): Promise<string | null> => ipcRenderer.invoke('dialog:openAudio'),
  getAudioDuration: (filePath: string): Promise<number> => ipcRenderer.invoke('ffprobe:audioDuration', filePath),

  // Full render
  renderTimeline: (payload: {
    timelineClips: any[]
    clips: any[]
    musicTracks: any[]
    outputPath: string
    fps: number
    codec: string
    quality: string
    resolution: string
  }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('ffmpeg:renderTimeline', payload),

  // Render progress events
  onRenderProgress: (callback: (data: { elapsed: number }) => void) => {
    const handler = (_: any, data: any) => callback(data)
    ipcRenderer.on('render:progress', handler)
    return () => ipcRenderer.removeListener('render:progress', handler)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)

declare global {
  interface Window {
    electronAPI: typeof api
  }
}
