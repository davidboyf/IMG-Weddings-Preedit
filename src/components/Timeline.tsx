import React, { useRef, useCallback, useState, useEffect } from 'react'
import { Trash2, GripVertical, Film, MousePointer2, Scissors, Music, Volume2, ChevronRight } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatTimecode, formatDuration } from '../utils/timecode'
import type { MusicTrack } from '../types'

const MIN_CLIP_PX = 30
const BASE_PPS = 60

export default function Timeline() {
  const store = useProjectStore()
  const {
    timelineClips, clips, musicTracks,
    removeFromTimeline, reorderTimeline, trimTimelineClip, clearTimeline,
    timelineCursorSeconds, setTimelineCursor,
    settings, selectClip,
    addToTimeline,
    splitTimelineClip,
    selectedTimelineClipId, selectTimelineClip,
    timelineToolMode, setTimelineToolMode,
    addMusicTrack,
  } = store

  const [zoom, setZoom] = useState(1)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const [trim, setTrim] = useState<{ tcId: string; edge: 'in' | 'out'; startX: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [bladeHover, setBladeHover] = useState<{ tcId: string; x: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const pps = BASE_PPS * zoom
  const fps = settings.frameRate
  const totalDuration = timelineClips.reduce((s, tc) => s + tc.duration, 0)
  const totalWidth = Math.max(600, totalDuration * pps + 240)

  const getClipForTC = (sourceId: string) => clips.find((c) => c.id === sourceId)

  // ── Keyboard shortcuts: V = select, B = blade ─
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'v' || e.key === 'V') setTimelineToolMode('select')
      if (e.key === 'b' || e.key === 'B') setTimelineToolMode('blade')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setTimelineToolMode])

  // ── Drag reorder (within timeline) ─────────
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    if (timelineToolMode !== 'select') return
    setDragFrom(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/timeline-index', String(index))
  }
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes('text/timeline-index')) {
      setDragOver(index)
    }
  }
  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const timelineIdx = e.dataTransfer.getData('text/timeline-index')
    if (timelineIdx !== '' && dragFrom !== null && dragFrom !== index) {
      reorderTimeline(dragFrom, index)
    }
    setDragFrom(null)
    setDragOver(null)
  }
  const handleDragEnd = () => { setDragFrom(null); setDragOver(null) }

  // ── Drop from browser ───────────────────────
  const handleTimelineDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('text/clip-id')) {
      e.preventDefault()
      setIsDragOver(true)
    }
  }
  const handleTimelineDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const clipId = e.dataTransfer.getData('text/clip-id')
    if (clipId) addToTimeline(clipId)
  }
  const handleTimelineDragLeave = () => setIsDragOver(false)

  // ── Ruler click to seek ─────────────────────
  const handleRulerClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0)
    setTimelineCursor(Math.max(0, (x - 24) / pps))
  }, [pps, setTimelineCursor])

  // ── Edge trimming ───────────────────────────
  const handleTrimStart = (tcId: string, edge: 'in' | 'out') => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setTrim({ tcId, edge, startX: e.clientX })
  }

  useEffect(() => {
    if (!trim) return
    const onMove = (e: MouseEvent) => {
      const delta = (e.clientX - trim.startX) / pps
      trimTimelineClip(trim.tcId, trim.edge, delta)
      setTrim((prev) => prev ? { ...prev, startX: e.clientX } : null)
    }
    const onUp = () => setTrim(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [trim, pps, trimTimelineClip])

  // ── Clip click handler ──────────────────────
  const handleClipClick = (tcId: string, e: React.MouseEvent, clipEl: HTMLElement) => {
    e.stopPropagation()
    if (timelineToolMode === 'blade') {
      const rect = clipEl.getBoundingClientRect()
      const scrollLeft = containerRef.current?.scrollLeft ?? 0
      const tc = timelineClips.find((t) => t.id === tcId)
      if (!tc) return
      const clickXRelativeToClip = e.clientX - rect.left
      const clickTimeInSeconds = tc.timelineStart + clickXRelativeToClip / pps
      splitTimelineClip(tcId, clickTimeInSeconds)
    } else {
      selectTimelineClip(tcId)
    }
  }

  // ── Blade hover tracking ────────────────────
  const handleClipMouseMove = (tcId: string, e: React.MouseEvent) => {
    if (timelineToolMode !== 'blade') { setBladeHover(null); return }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setBladeHover({ tcId, x: e.clientX - rect.left })
  }

  const handleClipMouseLeave = () => {
    if (timelineToolMode === 'blade') setBladeHover(null)
  }

  // ── Add music track ─────────────────────────
  const handleAddMusic = async () => {
    const api = window.electronAPI
    const filePath = await api.openAudio()
    if (!filePath) return
    const duration = await api.getAudioDuration(filePath)
    const fileName = filePath.split('/').pop() ?? filePath
    const track: MusicTrack = {
      id: `mus_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      filePath,
      fileName,
      startAt: 0,
      volume: 0.8,
      fadeIn: 0,
      fadeOut: 0,
      duration,
    }
    addMusicTrack(track)
  }

  if (timelineClips.length === 0 && musicTracks.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-full flex-col gap-3 transition-colors ${isDragOver ? 'bg-[#e4bc72]/05' : ''}`}
        onDragOver={handleTimelineDragOver}
        onDrop={handleTimelineDrop}
        onDragLeave={handleTimelineDragLeave}
      >
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isDragOver ? 'bg-[#e4bc72]/20 border-[#e4bc72]/40' : ''}`}
          style={{ background: isDragOver ? undefined : 'rgba(255,255,255,0.04)', border: `1px solid ${isDragOver ? 'rgba(228,188,114,0.4)' : 'rgba(255,255,255,0.07)'}` }}>
          <Film className={`w-5 h-5 ${isDragOver ? 'text-[#e4bc72]' : 'text-white/20'}`} />
        </div>
        <p className="text-[12px] text-white/30">
          {isDragOver ? 'Drop to add to timeline' : <>Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/50 text-[10px]">E</kbd> or drag clips here</>}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col h-full transition-colors ${isDragOver ? 'bg-[#e4bc72]/[0.03]' : ''}`}
      style={{ background: isDragOver ? undefined : 'rgba(6,6,12,0.98)' }}
      onDragOver={handleTimelineDragOver}
      onDrop={handleTimelineDrop}
      onDragLeave={handleTimelineDragLeave}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.05] flex-shrink-0">
        {/* Tool mode buttons */}
        <div className="flex items-center gap-0.5 mr-1">
          <button
            onClick={() => setTimelineToolMode('select')}
            title="Select (V)"
            className={`p-1.5 rounded-md transition-colors ${
              timelineToolMode === 'select'
                ? 'bg-white/15 text-white/90'
                : 'text-white/35 hover:text-white/60 hover:bg-white/[0.05]'
            }`}>
            <MousePointer2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setTimelineToolMode('blade')}
            title="Blade (B)"
            className={`p-1.5 rounded-md transition-colors ${
              timelineToolMode === 'blade'
                ? 'bg-[#e4bc72]/20 text-[#e4bc72]'
                : 'text-white/35 hover:text-white/60 hover:bg-white/[0.05]'
            }`}>
            <Scissors className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="w-px h-4 bg-white/10" />

        <span className="text-[11px] text-white/40">Timeline</span>
        <span className="text-[11px] text-white/25">
          {timelineClips.length} clip{timelineClips.length !== 1 ? 's' : ''} · {formatDuration(totalDuration)}
        </span>
        <div className="flex-1" />

        {/* + Music */}
        <button onClick={handleAddMusic}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#e4bc72]/50 hover:text-[#e4bc72] hover:bg-[#e4bc72]/10 transition-colors">
          <Music className="w-3 h-3" />+ Music
        </button>

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30">Zoom</span>
          <input type="range" min="0.2" max="8" step="0.1" value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} className="w-20" />
          <span className="text-[10px] text-white/40 w-7 tabular-nums">{zoom.toFixed(1)}×</span>
        </div>
        <button onClick={clearTimeline}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors">
          <Trash2 className="w-3 h-3" />Clear
        </button>
      </div>

      {/* Track area */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div style={{ width: totalWidth, minHeight: '100%', position: 'relative' }}>

          {/* Ruler */}
          <div className="h-6 sticky top-0 z-10 flex-shrink-0 cursor-pointer"
            style={{ background: 'rgba(13,13,24,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            onClick={handleRulerClick}>
            {Array.from({ length: Math.ceil(totalDuration) + 12 }).map((_, i) => {
              const x = i * pps + 24
              const isMinor = i % 5 !== 0
              return (
                <div key={i} className="absolute top-0 flex flex-col" style={{ left: x }}>
                  <div className={`w-px ${isMinor ? 'h-2 bg-white/10' : 'h-4 bg-white/20'}`} />
                  {!isMinor && (
                    <span className="text-[9px] text-white/30 font-mono pl-1 absolute top-1 left-0">
                      {formatTimecode(i, fps)}
                    </span>
                  )}
                </div>
              )
            })}
            {/* Playhead on ruler */}
            <div className="absolute top-0 bottom-0 pointer-events-none z-20"
              style={{ left: timelineCursorSeconds * pps + 24 }}>
              <div className="w-0 h-0 -translate-x-1/2"
                style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #e4bc72' }} />
              <div className="w-px h-full bg-[#e4bc72]/70 translate-x-[-0.5px]" />
            </div>
          </div>

          {/* Video track */}
          <div className="relative mt-1" style={{ height: 52 }}>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-white/20 z-10">V1</span>
            <div className="absolute inset-y-0" style={{ left: 20, right: 0 }}>
              {timelineClips.map((tc, index) => {
                const src = getClipForTC(tc.sourceClipId)
                const clipW = Math.max(MIN_CLIP_PX, tc.duration * pps)
                const flagColor = src?.flag === 'pick' ? '#34d399' : src?.flag === 'reject' ? '#f87171' : src?.flag === 'review' ? '#fbbf24' : '#3a3a5c'
                const isSelected = selectedTimelineClipId === tc.id
                const isBladeTarget = bladeHover?.tcId === tc.id

                return (
                  <div key={tc.id}
                    className={`absolute inset-y-1 rounded-lg overflow-hidden group/tc transition-opacity ${
                      timelineToolMode === 'blade' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
                    } ${dragFrom === index ? 'opacity-40' : dragOver === index ? 'ring-2 ring-[#e4bc72]' : ''} ${
                      isSelected ? 'ring-1 ring-[#e4bc72]/30' : ''
                    }`}
                    style={{
                      left: tc.timelineStart * pps,
                      width: clipW,
                      background: 'rgba(255,255,255,0.07)',
                      border: isSelected
                        ? '1px solid rgba(228,188,114,0.5)'
                        : `1px solid rgba(255,255,255,0.1)`,
                      borderLeft: isSelected
                        ? `3px solid #e4bc72`
                        : `3px solid ${flagColor}`,
                    }}
                    draggable={timelineToolMode === 'select'}
                    onDragStart={handleDragStart(index)}
                    onDragOver={handleDragOver(index)}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    onDoubleClick={() => {
                      if (timelineToolMode === 'select' && src) selectClip(src.id)
                    }}
                    onClick={(e) => handleClipClick(tc.id, e, e.currentTarget)}
                    onMouseMove={(e) => handleClipMouseMove(tc.id, e)}
                    onMouseLeave={handleClipMouseLeave}
                  >
                    {/* Thumbnail strip */}
                    {src?.thumbnail && (
                      <div className="absolute inset-0 opacity-25 pointer-events-none">
                        <img src={src.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
                      </div>
                    )}

                    {/* Content */}
                    <div className="relative flex items-center h-full px-1.5 gap-1 overflow-hidden">
                      <GripVertical className="w-3 h-3 text-white/30 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-medium text-white/80 truncate">{src?.fileName ?? '—'}</p>
                        <p className="text-[9px] text-white/40 truncate">{formatDuration(tc.duration)}</p>
                      </div>

                      {/* Speed badge */}
                      {tc.speed !== 1 && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0"
                          style={{ background: 'rgba(228,188,114,0.2)', color: '#e4bc72' }}>
                          {tc.speed}×
                        </span>
                      )}

                      <button
                        onClick={(e) => { e.stopPropagation(); removeFromTimeline(tc.id) }}
                        className="p-0.5 opacity-0 group-hover/tc:opacity-100 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded transition-all flex-shrink-0">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* In trim handle */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/tc:opacity-100 transition-opacity z-10 flex items-center justify-center"
                      style={{ background: 'rgba(52,211,153,0.6)', borderRadius: '2px 0 0 2px' }}
                      onMouseDown={handleTrimStart(tc.id, 'in')}
                    >
                      <div className="w-0.5 h-3/4 bg-white/60 rounded-full" />
                    </div>

                    {/* Out trim handle */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover/tc:opacity-100 transition-opacity z-10 flex items-center justify-center"
                      style={{ background: 'rgba(248,113,113,0.6)', borderRadius: '0 2px 2px 0' }}
                      onMouseDown={handleTrimStart(tc.id, 'out')}
                    >
                      <div className="w-0.5 h-3/4 bg-white/60 rounded-full" />
                    </div>

                    {/* Transition out indicator */}
                    {tc.transitionOut?.type && tc.transitionOut.type !== 'none' && tc.transitionOut.duration > 0 && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none z-20">
                        <ChevronRight className="w-3 h-3 text-[#e4bc72]/60" />
                      </div>
                    )}

                    {/* Blade hover line */}
                    {timelineToolMode === 'blade' && isBladeTarget && bladeHover && (
                      <div className="absolute top-0 bottom-0 w-px pointer-events-none z-30"
                        style={{ left: bladeHover.x, background: '#e4bc72', boxShadow: '0 0 4px #e4bc72' }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Playhead */}
            <div className="absolute top-0 bottom-0 w-px bg-[#e4bc72]/60 pointer-events-none z-20"
              style={{ left: timelineCursorSeconds * pps + 24 }} />
          </div>

          {/* Audio track */}
          <div className="relative mt-0.5" style={{ height: 32 }}>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-white/20 z-10">A1</span>
            <div className="absolute inset-y-0" style={{ left: 20, right: 0 }}>
              {timelineClips.map((tc) => {
                const w = Math.max(MIN_CLIP_PX, tc.duration * pps)
                return (
                  <div key={`a_${tc.id}`} className="absolute inset-y-1 rounded overflow-hidden"
                    style={{
                      left: tc.timelineStart * pps,
                      width: w,
                      background: 'rgba(228,188,114,0.06)',
                      border: '1px solid rgba(228,188,114,0.1)',
                    }}>
                    <div className="flex items-center justify-center h-full gap-px px-0.5">
                      {Array.from({ length: Math.max(3, Math.floor(w / 4)) }).map((_, i) => (
                        <div key={i} className="flex-1 rounded-full"
                          style={{
                            background: 'rgba(228,188,114,0.45)',
                            height: `${25 + Math.sin(i * 0.9) * 20 + Math.cos(i * 1.4) * 15}%`,
                          }} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Music track */}
          <div className="relative mt-0.5" style={{ height: 32 }}>
            <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-[#e4bc72]/30 z-10">M</span>
            <div className="absolute inset-y-0" style={{ left: 20, right: 0 }}>
              {musicTracks.map((mt) => {
                const w = Math.max(MIN_CLIP_PX, mt.duration * pps)
                return (
                  <div key={`m_${mt.id}`}
                    className="absolute inset-y-1 rounded overflow-hidden group/mt cursor-pointer"
                    style={{
                      left: mt.startAt * pps,
                      width: w,
                      background: 'rgba(228,188,114,0.12)',
                      border: '1px solid rgba(228,188,114,0.25)',
                    }}
                    onDoubleClick={() => {/* future: open music editor */}}
                  >
                    <div className="flex items-center h-full px-1.5 gap-1 overflow-hidden">
                      <Volume2 className="w-2.5 h-2.5 text-[#e4bc72]/60 flex-shrink-0" />
                      <p className="text-[9px] text-[#e4bc72]/70 truncate flex-1">{mt.fileName}</p>
                      <button
                        onClick={(e) => { e.stopPropagation(); store.removeMusicTrack(mt.id) }}
                        className="p-0.5 opacity-0 group-hover/mt:opacity-100 text-[#e4bc72]/40 hover:text-red-400 hover:bg-red-400/10 rounded transition-all flex-shrink-0">
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
              {musicTracks.length === 0 && (
                <div className="absolute inset-y-1 inset-x-0 flex items-center px-2">
                  <p className="text-[9px] text-white/15">No music — click + Music to add</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
