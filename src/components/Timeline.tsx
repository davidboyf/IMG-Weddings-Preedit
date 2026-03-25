import React, { useRef, useCallback, useState } from 'react'
import { Trash2, GripVertical, Plus, Film, Scissors } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatTimecode, formatDuration } from '../utils/timecode'

const MIN_CLIP_PX = 40
const PIXELS_PER_SECOND = 60 // base zoom

export default function Timeline() {
  const {
    timelineClips, clips,
    removeFromTimeline, reorderTimeline, clearTimeline,
    timelineCursorSeconds, setTimelineCursor,
    settings,
    selectClip,
  } = useProjectStore()

  const [zoom, setZoom] = useState(1)
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const pps = PIXELS_PER_SECOND * zoom
  const fps = settings.frameRate
  const totalDuration = timelineClips.reduce((s, tc) => s + tc.duration, 0)
  const totalWidth = Math.max(600, totalDuration * pps + 200)

  const getClipForTC = (sourceId: string) => clips.find((c) => c.id === sourceId)

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDragFrom(index)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(index)
  }
  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    if (dragFrom !== null && dragFrom !== index) {
      reorderTimeline(dragFrom, index)
    }
    setDragFrom(null)
    setDragOver(null)
  }
  const handleDragEnd = () => {
    setDragFrom(null)
    setDragOver(null)
  }

  // Click on ruler to seek
  const handleRulerClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left + containerRef.current!.scrollLeft
    const t = x / pps
    setTimelineCursor(Math.max(0, t))
  }, [pps])

  if (timelineClips.length === 0) {
    return (
      <div className="flex items-center justify-center h-full flex-col gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Film className="w-5 h-5 text-white/20" />
        </div>
        <p className="text-[12px] text-white/30">Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/50 text-[10px]">E</kbd> or click "Timeline" to add clips</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'rgba(6,6,12,0.98)' }}>
      {/* Timeline toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.05] flex-shrink-0">
        <span className="text-[11px] text-white/40">Timeline</span>
        <span className="text-[11px] text-white/25">
          {timelineClips.length} clip{timelineClips.length !== 1 ? 's' : ''} · {formatDuration(totalDuration)}
        </span>
        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/30">Zoom</span>
          <input
            type="range" min="0.2" max="8" step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-[10px] text-white/40 w-8">{zoom.toFixed(1)}×</span>
        </div>

        <button
          onClick={clearTimeline}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      {/* Scrollable track area */}
      <div className="flex-1 overflow-auto" ref={containerRef}>
        <div style={{ width: totalWidth, minHeight: '100%', position: 'relative' }}>
          {/* Ruler */}
          <div
            className="h-6 sticky top-0 z-10 flex-shrink-0 cursor-pointer"
            style={{ background: 'rgba(13,13,24,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            onClick={handleRulerClick}
          >
            {/* Tick marks */}
            {Array.from({ length: Math.ceil(totalDuration) + 10 }).map((_, i) => {
              const x = i * pps
              const isMinor = i % 5 !== 0
              return (
                <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: x }}>
                  <div className={`w-px ${isMinor ? 'h-2 bg-white/10' : 'h-4 bg-white/20'}`} />
                  {!isMinor && (
                    <span className="text-[9px] text-white/30 font-mono pl-0.5"
                      style={{ position: 'absolute', top: 4, left: 2 }}>
                      {formatTimecode(i, fps)}
                    </span>
                  )}
                </div>
              )
            })}

            {/* Playhead on ruler */}
            <div
              className="absolute top-0 bottom-0 w-px bg-[#e4bc72] z-20"
              style={{ left: timelineCursorSeconds * pps }}
            >
              <div className="w-2 h-2 bg-[#e4bc72] rounded-sm -translate-x-1/2" />
            </div>
          </div>

          {/* Video track */}
          <div className="relative" style={{ height: 56, marginTop: 4 }}>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <span className="text-[10px] text-white/20 px-2 select-none sticky left-0">V1</span>
            </div>

            {timelineClips.map((tc, index) => {
              const sourceClip = getClipForTC(tc.sourceClipId)
              const clipWidth = Math.max(MIN_CLIP_PX, tc.duration * pps)
              const flagColor = sourceClip?.flag === 'pick' ? '#34d399' :
                                sourceClip?.flag === 'reject' ? '#f87171' :
                                sourceClip?.flag === 'review' ? '#fbbf24' : '#4a4a6a'

              return (
                <div
                  key={tc.id}
                  className={`absolute inset-y-0 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing group transition-opacity ${
                    dragFrom === index ? 'opacity-50' : dragOver === index ? 'ring-2 ring-[#e4bc72]' : ''
                  }`}
                  style={{
                    left: tc.timelineStart * pps + 24,
                    width: clipWidth,
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid rgba(255,255,255,0.1)`,
                    borderLeft: `3px solid ${flagColor}`,
                  }}
                  draggable
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  onDoubleClick={() => sourceClip && selectClip(sourceClip.id)}
                >
                  {/* Thumbnail strip */}
                  {sourceClip?.thumbnail && (
                    <div className="absolute inset-0 opacity-30">
                      <img src={sourceClip.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
                    </div>
                  )}

                  {/* Content */}
                  <div className="relative flex items-center h-full px-2 gap-1">
                    <GripVertical className="w-3 h-3 text-white/30 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-white/80 truncate">
                        {sourceClip?.fileName ?? 'Unknown'}
                      </p>
                      <p className="text-[9px] text-white/40">
                        {formatDuration(tc.duration)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromTimeline(tc.id) }}
                      className="p-0.5 rounded text-white/0 group-hover:text-white/40 hover:!text-red-400 hover:bg-red-400/10 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Playhead line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-[#e4bc72]/70 pointer-events-none z-20"
              style={{ left: timelineCursorSeconds * pps + 24 }}
            />
          </div>

          {/* Audio track */}
          <div className="relative mt-1" style={{ height: 36 }}>
            <div className="absolute inset-y-0 left-0 flex items-center">
              <span className="text-[10px] text-white/20 px-2 select-none sticky left-0">A1</span>
            </div>
            {timelineClips.map((tc) => {
              const clipWidth = Math.max(MIN_CLIP_PX, tc.duration * pps)
              return (
                <div
                  key={`a_${tc.id}`}
                  className="absolute inset-y-0 rounded overflow-hidden"
                  style={{
                    left: tc.timelineStart * pps + 24,
                    width: clipWidth,
                    background: 'rgba(228,188,114,0.06)',
                    border: '1px solid rgba(228,188,114,0.12)',
                  }}
                >
                  {/* Mini waveform bars */}
                  <div className="flex items-center justify-center h-full gap-px px-1">
                    {Array.from({ length: Math.max(4, Math.floor(clipWidth / 4)) }).map((_, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-full"
                        style={{
                          background: 'rgba(228,188,114,0.5)',
                          height: `${30 + Math.sin(i * 0.8) * 20 + Math.cos(i * 1.3) * 15}%`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
