import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu } from 'electron'
import { join } from 'path'
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import { tmpdir, homedir } from 'os'
import { execFile } from 'child_process'

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ──────────────────────────────────────────────
// Simple key-value store (replaces electron-store)
// ──────────────────────────────────────────────
const storeDir = join(app.getPath('userData'), 'img-preedit')
const storePath = join(storeDir, 'settings.json')

function readStore(): Record<string, any> {
  try {
    if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true })
    if (!existsSync(storePath)) return {}
    return JSON.parse(readFileSync(storePath, 'utf-8'))
  } catch { return {} }
}

function writeStore(data: Record<string, any>) {
  try {
    if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true })
    writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf-8')
  } catch {}
}

// ──────────────────────────────────────────────
// FFprobe / FFmpeg resolution
// ──────────────────────────────────────────────
function findBinary(name: string): string {
  const packed = join(process.resourcesPath ?? '', name)
  if (existsSync(packed)) return packed
  const candidates = [
    `/usr/local/bin/${name}`,
    `/opt/homebrew/bin/${name}`,
    `/usr/bin/${name}`,
  ]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return name
}

const ffprobePath = findBinary('ffprobe')
const ffmpegPath = findBinary('ffmpeg')

// ──────────────────────────────────────────────
// Window
// ──────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1200,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#06060c',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow!.show())
  mainWindow.on('closed', () => { mainWindow = null })

  buildMenu()
}

// ──────────────────────────────────────────────
// Menu
// ──────────────────────────────────────────────
function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'Import Media…', accelerator: 'CmdOrCtrl+I', click: () => mainWindow?.webContents.send('menu:import') },
        { label: 'Import Folder…', accelerator: 'CmdOrCtrl+Shift+I', click: () => mainWindow?.webContents.send('menu:import-folder') },
        { type: 'separator' },
        { label: 'Save Project', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:save') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:open-project') },
        { type: 'separator' },
        { label: 'Export XML…', accelerator: 'CmdOrCtrl+E', click: () => mainWindow?.webContents.send('menu:export') },
        { label: 'Export Clips…', accelerator: 'CmdOrCtrl+Shift+E', click: () => mainWindow?.webContents.send('menu:export-clips') },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { label: 'Select All Clips', accelerator: 'CmdOrCtrl+A', click: () => mainWindow?.webContents.send('menu:select-all') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { label: 'Keyboard Shortcuts', accelerator: '?', click: () => mainWindow?.webContents.send('menu:shortcuts') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ──────────────────────────────────────────────
// App lifecycle
// ──────────────────────────────────────────────
app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ──────────────────────────────────────────────
// IPC: File dialogs
// ──────────────────────────────────────────────
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Video Files', extensions: ['mp4', 'mov', 'mxf', 'm4v', 'avi', 'mkv', 'webm', 'ts', 'mts', 'm2ts'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:saveFile', async (_e, opts: { defaultPath?: string; filters?: Electron.FileFilter[] }) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: opts.defaultPath ?? join(homedir(), 'Desktop', 'wedding-selects'),
    filters: opts.filters ?? [{ name: 'All Files', extensions: ['*'] }],
  })
  return result.canceled ? null : result.filePath
})

ipcMain.handle('dialog:openProject', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [{ name: 'IMG Preedit Project', extensions: ['imgpre'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openDirectory', async (_e, opts: { defaultPath?: string } = {}) => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    defaultPath: opts.defaultPath ?? homedir(),
  })
  return result.canceled ? null : result.filePaths[0]
})

// ──────────────────────────────────────────────
// IPC: File system
// ──────────────────────────────────────────────
ipcMain.handle('fs:writeFile', async (_e, filePath: string, content: string) => {
  writeFileSync(filePath, content, 'utf-8')
  return true
})

ipcMain.handle('fs:readFile', async (_e, filePath: string) => readFileSync(filePath, 'utf-8'))

ipcMain.handle('shell:openPath', async (_e, filePath: string) => shell.showItemInFolder(filePath))

ipcMain.handle('fs:scanFolder', async (_e, folderPath: string) => {
  const { readdirSync, statSync } = await import('fs')
  const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mxf', '.m4v', '.avi', '.mkv', '.webm', '.mts', '.m2ts', '.ts'])
  function scan(dir: string, depth = 0): string[] {
    if (depth > 3) return []
    try {
      return readdirSync(dir).flatMap((f) => {
        const full = join(dir, f)
        try {
          const stat = statSync(full)
          if (stat.isDirectory() && depth < 2) return scan(full, depth + 1)
          const ext = f.slice(f.lastIndexOf('.')).toLowerCase()
          if (VIDEO_EXTS.has(ext)) return [full]
        } catch { }
        return []
      })
    } catch { return [] }
  }
  return scan(folderPath)
})

// ──────────────────────────────────────────────
// IPC: Key-value store (recent projects etc.)
// ──────────────────────────────────────────────
ipcMain.handle('store:get', async (_e, key: string) => {
  return readStore()[key] ?? null
})

ipcMain.handle('store:set', async (_e, key: string, value: any) => {
  const data = readStore()
  data[key] = value
  writeStore(data)
  return true
})

// ──────────────────────────────────────────────
// IPC: FFprobe — metadata
// ──────────────────────────────────────────────
ipcMain.handle('ffprobe:info', async (_e, filePath: string) => {
  return new Promise((resolve, reject) => {
    const args = ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath]
    execFile(ffprobePath, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) return reject(err.message)
      try {
        const data = JSON.parse(stdout)
        const videoStream = data.streams?.find((s: any) => s.codec_type === 'video')
        const audioStream = data.streams?.find((s: any) => s.codec_type === 'audio')
        const fmt = data.format
        let fps = 24
        if (videoStream?.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number)
          fps = Math.round((num / den) * 100) / 100
        }
        resolve({
          duration: parseFloat(fmt?.duration ?? '0'),
          size: parseInt(fmt?.size ?? '0'),
          bitrate: parseInt(fmt?.bit_rate ?? '0'),
          codec: videoStream?.codec_name ?? 'unknown',
          width: videoStream?.width ?? 0,
          height: videoStream?.height ?? 0,
          fps,
          audioCodec: audioStream?.codec_name ?? null,
          audioChannels: audioStream?.channels ?? 0,
          audioSampleRate: parseInt(audioStream?.sample_rate ?? '0'),
          createdAt: fmt?.tags?.creation_time ?? null,
        })
      } catch (e) { reject(`Parse error: ${e}`) }
    })
  })
})

// ──────────────────────────────────────────────
// IPC: FFmpeg — thumbnail
// ──────────────────────────────────────────────
ipcMain.handle('ffmpeg:thumbnail', async (_e, filePath: string, timeSeconds: number) => {
  return new Promise((resolve) => {
    const outPath = join(tmpdir(), `img_thumb_${Date.now()}.jpg`)
    const args = ['-ss', String(timeSeconds), '-i', filePath, '-vframes', '1', '-q:v', '3', '-vf', 'scale=320:-1', '-y', outPath]
    execFile(ffmpegPath, args, (err) => {
      if (err || !existsSync(outPath)) return resolve(null)
      try {
        const data = readFileSync(outPath).toString('base64')
        resolve(`data:image/jpeg;base64,${data}`)
      } catch { resolve(null) }
    })
  })
})

// ──────────────────────────────────────────────
// IPC: FFmpeg — waveform peaks
// ──────────────────────────────────────────────
ipcMain.handle('ffmpeg:waveform', async (_e, filePath: string, numSamples: number) => {
  return new Promise((resolve) => {
    const tmpFile = join(tmpdir(), `img_wave_${Date.now()}.raw`)
    const args = ['-i', filePath, '-ac', '1', '-ar', '8000', '-f', 'u8', '-y', tmpFile]
    execFile(ffmpegPath, args, { maxBuffer: 50 * 1024 * 1024 }, (err) => {
      if (err || !existsSync(tmpFile)) return resolve([])
      try {
        const raw = readFileSync(tmpFile)
        const step = Math.max(1, Math.floor(raw.length / numSamples))
        const peaks: number[] = []
        for (let i = 0; i < raw.length; i += step) {
          let max = 0
          for (let j = i; j < Math.min(i + step, raw.length); j++) {
            const v = Math.abs(raw[j] - 128) / 128
            if (v > max) max = v
          }
          peaks.push(max)
        }
        resolve(peaks)
      } catch { resolve([]) }
    })
  })
})

// ──────────────────────────────────────────────
// IPC: FFmpeg — export / trim clip
// ──────────────────────────────────────────────
ipcMain.handle('ffmpeg:exportClip', async (
  _e,
  filePath: string,
  outPath: string,
  inPoint: number,
  outPoint: number,
  useProxy: boolean
) => {
  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    const args: string[] = [
      '-ss', String(inPoint),
      '-to', String(outPoint),
      '-i', filePath,
      '-c', 'copy',         // stream copy — fast, lossless cut
      '-avoid_negative_ts', 'make_zero',
      '-y',
      outPath,
    ]
    execFile(ffmpegPath, args, { maxBuffer: 100 * 1024 * 1024 }, (err) => {
      if (err) resolve({ success: false, error: err.message })
      else resolve({ success: true })
    })
  })
})

// ──────────────────────────────────────────────
// IPC: FFmpeg — create proxy (with progress via events)
// ──────────────────────────────────────────────
ipcMain.handle('ffmpeg:createProxy', async (_e, clipId: string, filePath: string, outputDir: string) => {
  return new Promise<{ success: boolean; proxyPath?: string; error?: string }>((resolve) => {
    const name = filePath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? 'clip'
    const proxyPath = join(outputDir, `${name}_proxy.mp4`)

    const args = [
      '-i', filePath,
      '-vf', 'scale=1280:-2',
      '-c:v', 'libx264',
      '-crf', '23',
      '-preset', 'fast',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-y',
      proxyPath,
    ]

    const proc = execFile(ffmpegPath, args, { maxBuffer: 200 * 1024 * 1024 }, (err) => {
      if (err) resolve({ success: false, error: err.message })
      else resolve({ success: true, proxyPath })
    })

    // Stream stderr for progress events
    proc.stderr?.on('data', (data: Buffer) => {
      const str = data.toString()
      const timeMatch = str.match(/time=(\d+):(\d+):(\d+\.\d+)/)
      if (timeMatch) {
        const h = parseInt(timeMatch[1])
        const m = parseInt(timeMatch[2])
        const s = parseFloat(timeMatch[3])
        const elapsed = h * 3600 + m * 60 + s
        mainWindow?.webContents.send('proxy:progress', { clipId, elapsed })
      }
    })
  })
})
