import React, { useState, useEffect, useRef } from 'react'
import { X, FolderOpen, Clapperboard, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatDuration } from '../utils/timecode'

interface Props {
  onClose: () => void
}

type RenderCodec = 'h264' | 'h265'
type RenderQuality = 'high' | 'medium' | 'low'
type RenderResolution = 'original' | '4k' | '1080p' | '720p'
type RenderState = 'idle' | 'rendering' | 'done' | 'error'

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9_\-]/gi, '-').replace(/-+/g, '-').toLowerCase() || 'render'
}

export default function RenderModal({ onClose }: Props) {
  const { timelineClips, clips, musicTracks, settings } = useProjectStore()

  const defaultName = sanitizeFilename(settings.name || 'render')
  const defaultPath = `/Users/${defaultName}.mp4`

  const [outputPath, setOutputPath] = useState(defaultPath)
  const [codec, setCodec] = useState<RenderCodec>('h264')
  const [quality, setQuality] = useState<RenderQuality>('high')
  const [resolution, setResolution] = useState<RenderResolution>('original')
  const [renderState, setRenderState] = useState<RenderState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [outputFilePath, setOutputFilePath] = useState('')

  const unsubRef = useRef<(() => void) | null>(null)

  const totalDuration = timelineClips.reduce((s, tc) => s + tc.duration, 0)

  // Set default output path based on settings on mount
  useEffect(() => {
    const name = sanitizeFilename(settings.name || 'render')
    setOutputPath(`/Users/${name}-render.mp4`)
    // Try to get Desktop path via electronAPI
    ;(async () => {
      try {
        // Use saveFile dialog default logic — we just show a sensible default
        const desktopPath = `/Users/${name}-render.mp4`
        setOutputPath(desktopPath)
      } catch { /* use fallback */ }
    })()
  }, [settings.name])

  const handleBrowse = async () => {
    const path = await window.electronAPI.saveFile({
      defaultPath: outputPath,
      filters: [
        { name: 'MP4 Video', extensions: ['mp4'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (path) setOutputPath(path)
  }

  const handleRender = async () => {
    if (!outputPath) return
    setRenderState('rendering')
    setElapsed(0)
    setErrorMsg('')

    // Subscribe to progress
    const unsub = window.electronAPI.onRenderProgress((data) => {
      setElapsed(data.elapsed)
    })
    unsubRef.current = unsub

    try {
      const result = await window.electronAPI.renderTimeline({
        timelineClips: timelineClips as any[],
        clips: clips as any[],
        musicTracks: musicTracks as any[],
        outputPath,
        fps: settings.frameRate,
        codec,
        quality,
        resolution,
      })

      if (result.success) {
        setRenderState('done')
        setOutputFilePath(outputPath)
      } else {
        setRenderState('error')
        setErrorMsg(result.error ?? 'Unknown render error')
      }
    } catch (e: any) {
      setRenderState('error')
      setErrorMsg(e?.message ?? String(e))
    } finally {
      unsubRef.current?.()
      unsubRef.current = null
    }
  }

  const handleOpenInFinder = async () => {
    if (outputFilePath) {
      await window.electronAPI.showInFinder(outputFilePath)
    }
  }

  const isRendering = renderState === 'rendering'
  const isDone = renderState === 'done'
  const isError = renderState === 'error'

  // Progress estimation: assume 1x realtime for high quality, 2x for medium/low
  const estimatedTotal = totalDuration * (quality === 'high' ? 2 : 1.2)
  const progressPct = estimatedTotal > 0 ? Math.min(99, (elapsed / estimatedTotal) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
      <div className="relative w-[520px] rounded-2xl overflow-hidden"
        style={{
          background: '#06060c',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Clapperboard className="w-4 h-4 text-[#e4bc72]" />
            <span className="text-[13px] font-semibold text-white/90">Render Video</span>
          </div>
          <button onClick={onClose} disabled={isRendering}
            className="p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-colors disabled:opacity-40">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Timeline stats */}
          <div className="rounded-xl p-3 flex items-center gap-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-center">
              <p className="text-[10px] text-white/35 mb-0.5">Duration</p>
              <p className="text-[13px] font-semibold text-white/80 font-mono">{formatDuration(totalDuration)}</p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] text-white/35 mb-0.5">Clips</p>
              <p className="text-[13px] font-semibold text-white/80">{timelineClips.length}</p>
            </div>
            <div className="w-px h-6 bg-white/10" />
            <div className="text-center">
              <p className="text-[10px] text-white/35 mb-0.5">Music</p>
              <p className="text-[13px] font-semibold text-white/80">{musicTracks.length}</p>
            </div>
          </div>

          {/* Output path */}
          <div>
            <p className="text-[10px] text-white/40 mb-1.5">Output File</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                disabled={isRendering}
                placeholder="/path/to/output.mp4"
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/75 outline-none focus:border-[#e4bc72]/40 disabled:opacity-50 font-mono"
              />
              <button onClick={handleBrowse} disabled={isRendering}
                className="px-3 py-2 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors disabled:opacity-40 flex-shrink-0"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="text-[10px] text-white/40 mb-1.5">Codec</p>
            <div className="flex gap-2">
              {(['h264', 'h265'] as RenderCodec[]).map((c) => (
                <button key={c} onClick={() => !isRendering && setCodec(c)}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-medium transition-colors ${
                    codec === c
                      ? 'text-[#e4bc72] border border-[#e4bc72]/40'
                      : 'text-white/40 border border-white/[0.07] hover:text-white/60'
                  }`}
                  style={{ background: codec === c ? 'rgba(228,188,114,0.08)' : 'rgba(255,255,255,0.03)' }}>
                  {c === 'h264' ? 'H.264' : 'H.265 (HEVC)'}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <p className="text-[10px] text-white/40 mb-1.5">Quality</p>
            <div className="flex gap-2">
              {([
                { id: 'high', label: 'High', sub: 'CRF 18' },
                { id: 'medium', label: 'Medium', sub: 'CRF 23' },
                { id: 'low', label: 'Low', sub: 'CRF 28' },
              ] as { id: RenderQuality; label: string; sub: string }[]).map(({ id, label, sub }) => (
                <button key={id} onClick={() => !isRendering && setQuality(id)}
                  className={`flex-1 py-2 px-2 rounded-xl text-center transition-colors ${
                    quality === id
                      ? 'text-[#e4bc72] border border-[#e4bc72]/40'
                      : 'text-white/40 border border-white/[0.07] hover:text-white/60'
                  }`}
                  style={{ background: quality === id ? 'rgba(228,188,114,0.08)' : 'rgba(255,255,255,0.03)' }}>
                  <p className="text-[12px] font-medium">{label}</p>
                  <p className="text-[9px] opacity-60 mt-0.5">{sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div>
            <p className="text-[10px] text-white/40 mb-1.5">Resolution</p>
            <div className="flex gap-2">
              {([
                { id: 'original', label: 'Original' },
                { id: '4k', label: '4K' },
                { id: '1080p', label: '1080p' },
                { id: '720p', label: '720p' },
              ] as { id: RenderResolution; label: string }[]).map(({ id, label }) => (
                <button key={id} onClick={() => !isRendering && setResolution(id)}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-medium transition-colors ${
                    resolution === id
                      ? 'text-[#e4bc72] border border-[#e4bc72]/40'
                      : 'text-white/40 border border-white/[0.07] hover:text-white/60'
                  }`}
                  style={{ background: resolution === id ? 'rgba(228,188,114,0.08)' : 'rgba(255,255,255,0.03)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress / Status */}
          {isRendering && (
            <div className="rounded-xl p-4 space-y-3"
              style={{ background: 'rgba(228,188,114,0.05)', border: '1px solid rgba(228,188,114,0.15)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[#e4bc72] animate-spin" />
                  <span className="text-[12px] text-[#e4bc72]/80">Rendering…</span>
                </div>
                <span className="text-[11px] text-white/40 font-mono">
                  {formatDuration(elapsed)} / ~{formatDuration(estimatedTotal)}
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #e4bc72, #f0d090)' }}
                />
              </div>
              <p className="text-[10px] text-white/30">{Math.round(progressPct)}% complete</p>
            </div>
          )}

          {isDone && (
            <div className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <CheckCircle className="w-5 h-5 text-[#34d399] flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[12px] font-semibold text-[#34d399]">Render complete</p>
                <p className="text-[10px] text-white/40 mt-0.5 truncate">{outputFilePath}</p>
              </div>
              <button onClick={handleOpenInFinder}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-[#34d399] hover:bg-[#34d399]/10 transition-colors border border-[#34d399]/20">
                Show in Finder
              </button>
            </div>
          )}

          {isError && (
            <div className="rounded-xl p-4 flex items-start gap-3"
              style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-red-400">Render failed</p>
                <p className="text-[11px] text-red-400/60 mt-1 break-words">{errorMsg}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} disabled={isRendering}
            className="px-4 py-2 rounded-xl text-[12px] font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-colors disabled:opacity-40">
            {isDone ? 'Close' : 'Cancel'}
          </button>
          {!isDone && (
            <button
              onClick={handleRender}
              disabled={isRendering || !outputPath || timelineClips.length === 0}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: isRendering ? 'rgba(228,188,114,0.2)' : 'rgba(228,188,114,0.9)',
                color: isRendering ? '#e4bc72' : '#0a0a14',
              }}>
              {isRendering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Rendering…
                </>
              ) : (
                <>
                  <Clapperboard className="w-3.5 h-3.5" />
                  Render Video
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
