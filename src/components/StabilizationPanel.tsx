import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Crosshair, Play, CheckCircle2, AlertCircle, FolderOpen, ToggleLeft, ToggleRight, RefreshCw, Zap } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import type { MediaClip, StabilizationMode } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Stabilization modes — tuned for real wedding filming scenarios
// ─────────────────────────────────────────────────────────────────────────────
const MODES: {
  id: StabilizationMode
  label: string
  description: string
  hint: string
  color: string
}[] = [
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Maximum smoothing for handheld footage',
    hint: 'Best for: ceremony walks, first dances, walking shots',
    color: '#a78bfa',
  },
  {
    id: 'walk',
    label: 'Walk & Talk',
    description: 'Smooth but preserves natural movement',
    hint: 'Best for: following subjects, candid moments',
    color: '#60a5fa',
  },
  {
    id: 'locked',
    label: 'Locked Off',
    description: 'Virtual tripod — eliminates all shake',
    hint: 'Best for: speeches, ring exchanges, seated shots',
    color: '#34d399',
  },
  {
    id: 'action',
    label: 'Action',
    description: 'Light stabilization preserving energy',
    hint: 'Best for: receptions, dancing, confetti moments',
    color: '#fbbf24',
  },
]

interface StabJob {
  clipId: string
  fileName: string
  status: 'queued' | 'analyzing' | 'stabilizing' | 'done' | 'error'
  progress: number   // 0–100
  error?: string
}

export default function StabilizationPanel() {
  const {
    clips, selectedClipIds,
    setStabilizationStatus, setUseStabilized,
  } = useProjectStore()

  const [mode, setMode] = useState<StabilizationMode>('cinematic')
  const [outputDir, setOutputDir] = useState('')
  const [jobs, setJobs] = useState<StabJob[]>([])
  const [running, setRunning] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  // Load saved output dir
  useEffect(() => {
    window.electronAPI.storeGet('stabOutputDir').then((v) => { if (v) setOutputDir(v) }).catch(() => {})
    const unsub = window.electronAPI.onStabilizationProgress((data) => {
      setJobs((prev) => prev.map((j) => {
        if (j.clipId !== data.clipId) return j
        const status = data.phase === 'analyze' ? 'analyzing' : 'stabilizing'
        const progress = data.phase === 'analyze'
          ? Math.round(data.elapsed / (data.totalDuration ?? 1) * 50)
          : 50 + Math.round(data.elapsed / (data.totalDuration ?? 1) * 50)
        return { ...j, status, progress: Math.min(progress, 95) }
      }))
    })
    unsubRef.current = unsub
    return () => unsub()
  }, [])

  const handleBrowse = async () => {
    const dir = await window.electronAPI.openDirectory()
    if (dir) {
      setOutputDir(dir)
      await window.electronAPI.storeSet('stabOutputDir', dir)
    }
  }

  const clipsToProcess: MediaClip[] = selectedClipIds.length > 0
    ? clips.filter((c) => selectedClipIds.includes(c.id))
    : clips.filter((c) => c.flag === 'pick' || c.stabilizationStatus === 'none')

  const run = useCallback(async () => {
    if (!outputDir || clipsToProcess.length === 0 || running) return
    setRunning(true)

    const initialJobs: StabJob[] = clipsToProcess.map((c) => ({
      clipId: c.id,
      fileName: c.fileName,
      status: 'queued',
      progress: 0,
    }))
    setJobs(initialJobs)

    for (const clip of clipsToProcess) {
      setStabilizationStatus(clip.id, 'analyzing')
      setJobs((prev) => prev.map((j) => j.clipId === clip.id ? { ...j, status: 'analyzing', progress: 0 } : j))

      const result = await window.electronAPI.stabilizeClip({
        clipId: clip.id,
        filePath: clip.filePath,
        outputDir,
        mode,
        duration: clip.info?.duration ?? 0,
      })

      if (result.success && result.stabilizedPath) {
        setStabilizationStatus(clip.id, 'done', result.stabilizedPath)
        setJobs((prev) => prev.map((j) => j.clipId === clip.id ? { ...j, status: 'done', progress: 100 } : j))
      } else {
        setStabilizationStatus(clip.id, 'error')
        setJobs((prev) => prev.map((j) => j.clipId === clip.id ? { ...j, status: 'error', error: result.error } : j))
      }
    }
    setRunning(false)
  }, [outputDir, clipsToProcess, mode, running, setStabilizationStatus])

  const doneCount  = jobs.filter((j) => j.status === 'done').length
  const errorCount = jobs.filter((j) => j.status === 'error').length

  const statusColor = (status: StabJob['status']) => {
    if (status === 'done')       return 'text-[#34d399]'
    if (status === 'error')      return 'text-[#f87171]'
    if (status === 'analyzing')  return 'text-[#fbbf24]'
    if (status === 'stabilizing') return 'text-[#60a5fa]'
    return 'text-white/25'
  }

  const statusLabel = (status: StabJob['status']) => {
    if (status === 'done')       return 'Done'
    if (status === 'error')      return 'Error'
    if (status === 'analyzing')  return 'Pass 1/2…'
    if (status === 'stabilizing') return 'Pass 2/2…'
    return 'Queued'
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-3 space-y-3 pb-6">

        {/* Mode selector */}
        <div>
          <p className="text-[10px] font-medium text-white/35 uppercase tracking-wider mb-2">Stabilization Mode</p>
          <div className="grid grid-cols-2 gap-1.5">
            {MODES.map((m) => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className="text-left p-2.5 rounded-xl transition-all"
                style={{
                  background: mode === m.id ? `${m.color}14` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${mode === m.id ? `${m.color}35` : 'rgba(255,255,255,0.06)'}`,
                }}>
                <p className="text-[11px] font-semibold" style={{ color: mode === m.id ? m.color : 'rgba(255,255,255,0.7)' }}>{m.label}</p>
                <p className="text-[9px] text-white/35 mt-0.5 leading-relaxed">{m.description}</p>
              </button>
            ))}
          </div>
          <p className="text-[9px] text-white/30 mt-1.5 italic">
            {MODES.find(m => m.id === mode)?.hint}
          </p>
        </div>

        {/* What each mode does */}
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[9px] font-medium text-white/30 uppercase tracking-wider mb-2">Pipeline</p>
          {[
            ['Pass 1', 'Motion analysis — detects every shake frame'],
            ['Pass 2', 'Path smoothing + adaptive zoom + bicubic warp'],
            ['+', 'Unsharp mask — restores detail after interpolation'],
            ['+', 'Deflicker — removes frame brightness fluctuation'],
          ].map(([step, desc]) => (
            <div key={step as string} className="flex items-start gap-2">
              <span className="text-[9px] font-mono text-[#e4bc72]/60 flex-shrink-0 w-10">{step}</span>
              <span className="text-[9px] text-white/40">{desc}</span>
            </div>
          ))}
        </div>

        {/* Output folder */}
        <div>
          <p className="text-[10px] text-white/35 mb-1.5">Output Folder</p>
          <div className="flex gap-2">
            <input type="text" value={outputDir} onChange={(e) => setOutputDir(e.target.value)}
              placeholder="/path/to/stabilized"
              className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white/70 outline-none focus:border-[#e4bc72]/40 min-w-0" />
            <button onClick={handleBrowse} className="btn-apple px-2.5 flex-shrink-0">
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Clips to process */}
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-medium text-white/40 mb-1.5">
            {selectedClipIds.length > 0 ? `${selectedClipIds.length} selected clips` : `${clipsToProcess.length} clips (picks)`}
          </p>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {clipsToProcess.slice(0, 12).map((clip) => (
              <div key={clip.id} className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-white/50 truncate flex-1">{clip.fileName}</p>
                <span className="text-[9px] text-white/25 flex-shrink-0">
                  {clip.stabilizationStatus === 'done' ? '✓ done' : clip.stabilizationStatus === 'error' ? '✗ err' : ''}
                </span>
              </div>
            ))}
            {clipsToProcess.length > 12 && (
              <p className="text-[10px] text-white/25">+{clipsToProcess.length - 12} more…</p>
            )}
          </div>
        </div>

        {/* Jobs progress */}
        {jobs.length > 0 && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-white/40">
                {running ? 'Processing…' : `${doneCount} done${errorCount > 0 ? `, ${errorCount} errors` : ''}`}
              </p>
              {!running && doneCount > 0 && (
                <div className="flex items-center gap-1 text-[#34d399]">
                  <CheckCircle2 className="w-3 h-3" />
                  <span className="text-[10px]">Complete</span>
                </div>
              )}
            </div>

            {/* Overall bar */}
            {running && (
              <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="h-full bg-[#e4bc72] transition-all"
                  style={{ width: `${jobs.filter(j => j.status === 'done').length / jobs.length * 100}%` }} />
              </div>
            )}

            <div className="space-y-1 max-h-32 overflow-y-auto">
              {jobs.map((job) => (
                <div key={job.clipId}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[10px] text-white/55 truncate flex-1">{job.fileName}</p>
                    <span className={`text-[9px] font-medium flex-shrink-0 ${statusColor(job.status)}`}>
                      {statusLabel(job.status)}
                    </span>
                  </div>
                  {(job.status === 'analyzing' || job.status === 'stabilizing') && (
                    <div className="h-0.5 rounded-full overflow-hidden ml-0" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full bg-[#e4bc72]/70 transition-all" style={{ width: `${job.progress}%` }} />
                    </div>
                  )}
                  {job.error && (
                    <p className="text-[9px] text-[#f87171]/70 mt-0.5 truncate">{job.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-clip toggle (when done) */}
        {jobs.some(j => j.status === 'done') && !running && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-medium text-white/40 mb-1">Use Stabilized Version</p>
            {clips.filter(c => c.stabilizationStatus === 'done').map((clip) => (
              <div key={clip.id} className="flex items-center justify-between">
                <p className="text-[10px] text-white/55 truncate flex-1 mr-2">{clip.fileName}</p>
                <button onClick={() => setUseStabilized(clip.id, !clip.useStabilized)}>
                  {clip.useStabilized
                    ? <ToggleRight className="w-5 h-5 text-[#34d399]" />
                    : <ToggleLeft className="w-5 h-5 text-white/30" />
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info note */}
        <p className="text-[9px] text-white/20 leading-relaxed">
          Two-pass FFmpeg vidstab · shakiness=10, accuracy=15 · optzoom=2 adaptive zoom · Bicubic warp · Unsharp + median deflicker · Original file preserved · For CMOS rolling shutter (jello), use Gyroflow or DaVinci Resolve
        </p>

        {/* Run button */}
        <button
          onClick={run}
          disabled={running || !outputDir || clipsToProcess.length === 0}
          className="w-full btn-apple btn-apple-accent flex items-center justify-center gap-2 py-2.5 disabled:opacity-50">
          {running
            ? <><RefreshCw className="w-4 h-4 animate-spin" />Stabilizing…</>
            : <><Zap className="w-4 h-4" />Stabilize {clipsToProcess.length} Clip{clipsToProcess.length !== 1 ? 's' : ''}</>
          }
        </button>
      </div>
    </div>
  )
}
