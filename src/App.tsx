import React, { useEffect, useCallback, useState, useRef } from 'react'
import { useProjectStore } from './stores/useProjectStore'
import TitleBar from './components/TitleBar'
import Toolbar from './components/Toolbar'
import MediaBrowser from './components/MediaBrowser'
import VideoPlayer from './components/VideoPlayer'
import InspectorPanel from './components/InspectorPanel'
import AudioPanel from './components/AudioPanel'
import Timeline from './components/Timeline'
import ExportModal from './components/ExportModal'
import ProjectSettingsModal from './components/ProjectSettingsModal'
import ImportProgress from './components/ImportProgress'
import WelcomeScreen from './components/WelcomeScreen'
import KeyboardShortcutsOverlay from './components/KeyboardShortcutsOverlay'
import ProxyPanel from './components/ProxyPanel'
import {
  generateFCPXML,
  generateXMEML,
  generateAAF,
  generateDaVinciXML,
  generateEDL,
  generateCSV,
} from './utils/xml-export'
import type { MediaClip, ExportFormat } from './types'

// ──────────────────────────────────────────────
// Import pipeline
// ──────────────────────────────────────────────
async function importFile(filePath: string): Promise<MediaClip | null> {
  const api = window.electronAPI
  const fileName = filePath.split('/').pop() ?? filePath
  try {
    const [info, thumbnail] = await Promise.all([
      api.getVideoInfo(filePath),
      api.getThumbnail(filePath, 0),
    ])
    const clip: MediaClip = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      filePath,
      fileName,
      thumbnail,
      info,
      inPoint: 0,
      outPoint: info.duration,
      inPointSet: false,
      outPointSet: false,
      rating: 0,
      flag: 'none',
      colorLabel: 'none',
      notes: '',
      markers: [],
      subClips: [],
      volume: 1,
      audioBalance: 0,
      importedAt: Date.now(),
      waveformPeaks: null,
      group: '',
      reelName: fileName.slice(0, 8),
      proxyPath: null,
      proxyStatus: 'none',
      useProxy: false,
    }
    return clip
  } catch (e) {
    console.error('Import failed:', filePath, e)
    return null
  }
}

// ──────────────────────────────────────────────
// App
// ──────────────────────────────────────────────
export default function App() {
  const store = useProjectStore()
  const [showExport, setShowExport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [leftWidth, setLeftWidth] = useState(280)
  const [rightWidth, setRightWidth] = useState(300)
  const [isDraggingLeft, setIsDraggingLeft] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false)
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Load recent projects on mount ───────────
  useEffect(() => {
    ;(async () => {
      try {
        const recent = await window.electronAPI.storeGet('recentProjects')
        if (Array.isArray(recent)) {
          store.setRecentProjects(recent)
        }
      } catch {
        // store not yet populated — fine
      }
    })()
  }, [])

  // ── Auto-save every 30s ──────────────────────
  useEffect(() => {
    autoSaveRef.current = setInterval(async () => {
      const state = useProjectStore.getState()
      if (!state.projectPath || state.clips.length === 0) return
      try {
        const json = JSON.stringify({
          version: '1.0',
          settings: state.settings,
          clips: state.clips,
          timeline: state.timelineClips,
          savedAt: Date.now(),
        }, null, 2)
        await window.electronAPI.writeFile(state.projectPath, json)
      } catch {
        // silent auto-save failure
      }
    }, 30_000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [])

  // ── Import handlers ─────────────────────────
  const handleImportFiles = useCallback(async () => {
    const api = window.electronAPI
    const paths = await api.openFiles()
    if (!paths.length) return
    store.setImporting(true, paths.length)

    const imported: MediaClip[] = []
    for (let i = 0; i < paths.length; i++) {
      const clip = await importFile(paths[i])
      if (clip) imported.push(clip)
      store.setImportProgress(i + 1)
    }
    store.addClips(imported)
    store.setImporting(false)
    if (imported.length === 1) store.selectClip(imported[0].id)
  }, [store])

  const handleImportFolder = useCallback(async () => {
    const api = window.electronAPI
    const folder = await api.openFolder()
    if (!folder) return
    const paths = await api.scanFolder(folder)
    if (!paths.length) return
    store.setImporting(true, paths.length)

    const imported: MediaClip[] = []
    for (let i = 0; i < paths.length; i++) {
      const clip = await importFile(paths[i])
      if (clip) imported.push(clip)
      store.setImportProgress(i + 1)
    }
    store.addClips(imported)
    store.setImporting(false)
  }, [store])

  // ── Export handler ──────────────────────────
  const handleExport = useCallback(async (format: ExportFormat) => {
    const api = window.electronAPI
    const { settings, clips, timelineClips } = useProjectStore.getState()

    let content = ''
    let ext = ''
    let filterName = ''
    switch (format) {
      case 'fcpxml':
        content = generateFCPXML(settings, clips, timelineClips)
        ext = 'fcpxml'
        filterName = 'Final Cut Pro XML'
        break
      case 'xmeml':
        content = generateXMEML(settings, clips, timelineClips)
        ext = 'xml'
        filterName = 'Premiere Pro / DaVinci XML'
        break
      case 'aaf':
        content = generateAAF(settings, clips, timelineClips)
        ext = 'xml'
        filterName = 'AAF-Compatible XML'
        break
      case 'davinci':
        content = generateDaVinciXML(settings, clips, timelineClips)
        ext = 'fcpxml'
        filterName = 'DaVinci Resolve XML'
        break
      case 'edl':
        content = generateEDL(settings, clips, timelineClips)
        ext = 'edl'
        filterName = 'Edit Decision List'
        break
      case 'csv':
        content = generateCSV(clips, settings.frameRate)
        ext = 'csv'
        filterName = 'CSV Log'
        break
      default:
        return
    }

    const savePath = await api.saveFile({
      defaultPath: `${settings.name.replace(/\s+/g, '-').toLowerCase()}.${ext}`,
      filters: [
        { name: filterName, extensions: [ext] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    if (savePath) {
      await api.writeFile(savePath, content)
      await api.showInFinder(savePath)
    }
    setShowExport(false)
  }, [])

  // ── Save / open project ─────────────────────
  const handleSaveProject = useCallback(async () => {
    const api = window.electronAPI
    const state = useProjectStore.getState()
    let savePath = state.projectPath
    if (!savePath) {
      savePath = await api.saveFile({
        defaultPath: `${state.settings.name.replace(/\s+/g, '-')}.imgpre`,
        filters: [{ name: 'IMG Preedit Project', extensions: ['imgpre'] }],
      })
    }
    if (!savePath) return
    const json = JSON.stringify({
      version: '1.0',
      settings: state.settings,
      clips: state.clips,
      timeline: state.timelineClips,
      savedAt: Date.now(),
    }, null, 2)
    await api.writeFile(savePath, json)
    store.markSaved(savePath)

    // Update recent projects
    const recents = useProjectStore.getState().recentProjects ?? []
    const next = [
      { path: savePath, name: state.settings.name, couple: state.settings.couple, savedAt: Date.now() },
      ...recents.filter((r: any) => r.path !== savePath),
    ].slice(0, 10)
    store.setRecentProjects(next)
    await api.storeSet('recentProjects', next)
  }, [store])

  const handleOpenProject = useCallback(async (filePath?: string) => {
    const api = window.electronAPI
    const path = filePath ?? (await api.openProject())
    if (!path) return
    const json = await api.readFile(path)
    const data = JSON.parse(json)
    store.loadProject({
      settings: data.settings,
      clips: data.clips,
      timelineClips: data.timeline,
      projectPath: path,
    })

    // Update recent
    const recents = useProjectStore.getState().recentProjects ?? []
    const next = [
      { path, name: data.settings.name, couple: data.settings.couple, savedAt: Date.now() },
      ...recents.filter((r: any) => r.path !== path),
    ].slice(0, 10)
    store.setRecentProjects(next)
    await api.storeSet('recentProjects', next)
  }, [store])

  // ── Global keyboard shortcuts ────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault()
        setShowShortcuts((v) => !v)
        return
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false)
        setShowExport(false)
        setShowSettings(false)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        store.selectAll()
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [store])

  // ── Menu event listeners ────────────────────
  useEffect(() => {
    const api = window.electronAPI
    const unsubs = [
      api.onMenu('import', handleImportFiles),
      api.onMenu('import-folder', handleImportFolder),
      api.onMenu('save', handleSaveProject),
      api.onMenu('open-project', () => handleOpenProject()),
      api.onMenu('export', () => setShowExport(true)),
      api.onMenu('select-all', () => store.selectAll()),
      api.onMenu('shortcuts', () => setShowShortcuts(true)),
    ]
    return () => unsubs.forEach((u) => u())
  }, [handleImportFiles, handleImportFolder, handleSaveProject, handleOpenProject, store])

  // ── Drag-to-resize panels ───────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft) {
        setLeftWidth(Math.max(200, Math.min(480, e.clientX)))
      }
      if (isDraggingRight) {
        setRightWidth(Math.max(220, Math.min(480, window.innerWidth - e.clientX)))
      }
      if (isDraggingTimeline) {
        const bottom = window.innerHeight - e.clientY
        store.setTimelineHeight(Math.max(120, Math.min(400, bottom)))
      }
    }
    const handleMouseUp = () => {
      setIsDraggingLeft(false)
      setIsDraggingRight(false)
      setIsDraggingTimeline(false)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingLeft, isDraggingRight, isDraggingTimeline, store])

  // ── Drop files onto window ──────────────────
  useEffect(() => {
    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      const files = Array.from(e.dataTransfer?.files ?? [])
        .filter((f) => f.type.startsWith('video/') || /\.(mp4|mov|mxf|avi|mkv|webm|mts|m2ts)$/i.test(f.name))
        .map((f) => (f as any).path as string)
      if (!files.length) return
      store.setImporting(true, files.length)
      const imported: MediaClip[] = []
      for (let i = 0; i < files.length; i++) {
        const clip = await importFile(files[i])
        if (clip) imported.push(clip)
        store.setImportProgress(i + 1)
      }
      store.addClips(imported)
      store.setImporting(false)
    }
    const handleDragOver = (e: DragEvent) => e.preventDefault()
    window.addEventListener('drop', handleDrop)
    window.addEventListener('dragover', handleDragOver)
    return () => {
      window.removeEventListener('drop', handleDrop)
      window.removeEventListener('dragover', handleDragOver)
    }
  }, [store])

  const { activePanel, showTimeline, timelineHeight, clips, importing } = store

  return (
    <div className="flex flex-col h-screen w-screen bg-[#06060c] overflow-hidden">
      {/* Title bar */}
      <TitleBar
        onSettings={() => setShowSettings(true)}
        onSave={handleSaveProject}
        onImport={handleImportFiles}
        onExport={() => setShowExport(true)}
      />

      {/* Welcome screen when no clips */}
      {clips.length === 0 && !importing && (
        <WelcomeScreen
          onImport={handleImportFiles}
          onImportFolder={handleImportFolder}
          onOpenProject={() => handleOpenProject()}
        />
      )}

      {/* Main layout — only shown when clips are loaded */}
      {clips.length > 0 && (
        <>
          {/* Toolbar */}
          <Toolbar
            onImport={handleImportFiles}
            onImportFolder={handleImportFolder}
            onExport={() => setShowExport(true)}
          />

          <div className="flex flex-1 overflow-hidden">
            {/* Left: Media Browser */}
            <div
              className="flex-shrink-0 flex flex-col overflow-hidden border-r border-white/[0.06]"
              style={{ width: leftWidth }}
            >
              <MediaBrowser onImport={handleImportFiles} onImportFolder={handleImportFolder} />
            </div>

            {/* Left resize handle */}
            <div
              className="resize-handle-v w-1 hover:bg-white/10 flex-shrink-0 transition-colors"
              onMouseDown={() => setIsDraggingLeft(true)}
            />

            {/* Center: Player + Timeline */}
            <div className="flex flex-col flex-1 overflow-hidden min-w-0">
              {/* Video player */}
              <div className="flex-1 overflow-hidden min-h-0">
                <VideoPlayer />
              </div>

              {/* Timeline resize handle */}
              {showTimeline && (
                <div
                  className="resize-handle h-1 bg-white/[0.04] hover:bg-white/10 flex-shrink-0 transition-colors flex items-center justify-center"
                  onMouseDown={() => setIsDraggingTimeline(true)}
                >
                  <div className="w-16 h-0.5 rounded-full bg-white/20" />
                </div>
              )}

              {/* Timeline */}
              {showTimeline && (
                <div
                  className="flex-shrink-0 border-t border-white/[0.06] overflow-hidden"
                  style={{ height: timelineHeight }}
                >
                  <Timeline />
                </div>
              )}
            </div>

            {/* Right resize handle */}
            <div
              className="resize-handle-v w-1 hover:bg-white/10 flex-shrink-0 transition-colors"
              onMouseDown={() => setIsDraggingRight(true)}
            />

            {/* Right: Inspector / Audio / Proxy */}
            <div
              className="flex-shrink-0 flex flex-col overflow-hidden border-l border-white/[0.06]"
              style={{ width: rightWidth }}
            >
              {/* Panel tabs */}
              <div className="flex border-b border-white/[0.06] flex-shrink-0">
                {(['inspector', 'audio', 'proxy'] as const).map((panel) => (
                  <button
                    key={panel}
                    onClick={() => store.setActivePanel(panel)}
                    className={`flex-1 py-2 text-xs font-medium tracking-wide capitalize transition-colors no-drag ${
                      activePanel === panel
                        ? 'text-white/90 border-b border-[#e4bc72]'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    {panel === 'inspector' ? 'Info' : panel === 'audio' ? 'Audio' : 'Proxy'}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-hidden">
                {activePanel === 'inspector' && <InspectorPanel />}
                {activePanel === 'audio' && <AudioPanel />}
                {activePanel === 'proxy' && <ProxyPanel />}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Import progress overlay */}
      {importing && <ImportProgress />}

      {/* Modals */}
      {showExport && (
        <ExportModal onExport={handleExport} onClose={() => setShowExport(false)} />
      )}
      {showSettings && (
        <ProjectSettingsModal onClose={() => setShowSettings(false)} />
      )}
      {showShortcuts && (
        <KeyboardShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  )
}
