import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Maximize2, Scissors,
  ChevronIn, ChevronOut, RotateCcw, Repeat,
  ArrowLeft, ArrowRight, Bookmark, Plus
} from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatTimecode, formatDuration } from '../utils/timecode'
import type { Marker } from '../types'

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const scrubRef = useRef<HTMLDivElement>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const [thumbnailCache, setThumbnailCache] = useState<Record<number, string>>({})
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)

  const {
    selectedClipId, clips,
    currentTime, setCurrentTime,
    isPlaying, setIsPlaying,
    playbackRate, setPlaybackRate,
    loopInOut, setLoopInOut,
    volume, setVolume,
    setInPoint, setOutPoint, clearInPoint, clearOutPoint,
    addToTimeline, addMarker,
  } = useProjectStore()

  const clip = clips.find((c) => c.id === selectedClipId) ?? null
  const duration = clip?.info?.duration ?? 0
  const fps = clip?.info?.fps ?? 24

  const inPt  = clip?.inPointSet  ? clip.inPoint  : 0
  const outPt = clip?.outPointSet ? clip.outPoint : duration

  // ── Video src ───────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return
    video.src = clip.filePath.startsWith('file://') ? clip.filePath : `file://${clip.filePath}`
    video.currentTime = 0
    setCurrentTime(0)
    setIsPlaying(false)
  }, [clip?.filePath])

  // ── Sync playback state ─────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = playbackRate
  }, [playbackRate])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = Math.min(1, Math.max(0, volume))
  }, [volume])

  // ── Time update ─────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      // Loop in/out
      if (loopInOut && video.currentTime >= outPt) {
        video.currentTime = inPt
      }
    }
    const onEnded = () => {
      if (loopInOut) {
        video.currentTime = inPt
        video.play()
      } else {
        setIsPlaying(false)
      }
    }

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
    }
  }, [loopInOut, inPt, outPt])

  // ── Keyboard shortcuts ──────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!clip) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          setIsPlaying(!isPlaying)
          break
        case 'j':
          e.preventDefault()
          if (video.playbackRate > 0) {
            video.playbackRate = -(e.shiftKey ? 2 : 1)
          } else {
            video.playbackRate = Math.max(-16, video.playbackRate * 2)
          }
          break
        case 'l':
          e.preventDefault()
          if (video.playbackRate < 0) {
            video.playbackRate = 1
          } else {
            video.playbackRate = Math.min(16, video.playbackRate * 2)
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 1 : 1 / fps))
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(duration, video.currentTime + (e.shiftKey ? 1 : 1 / fps))
          break
        case 'i':
          e.preventDefault()
          setInPoint(clip.id, video.currentTime)
          break
        case 'o':
          e.preventDefault()
          setOutPoint(clip.id, video.currentTime)
          break
        case 'x':
          e.preventDefault()
          clearInPoint(clip.id)
          clearOutPoint(clip.id)
          break
        case 'e':
          e.preventDefault()
          addToTimeline(clip.id)
          break
        case 'm':
          e.preventDefault()
          addMarker(clip.id, {
            id: `m_${Date.now()}`,
            timeSeconds: video.currentTime,
            label: `Marker ${clip.markers.length + 1}`,
            color: '#e4bc72',
          })
          break
        case 'Home':
          e.preventDefault()
          video.currentTime = inPt
          break
        case 'End':
          e.preventDefault()
          video.currentTime = outPt
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clip, isPlaying, fps, duration, inPt, outPt])

  // ── Scrub bar ───────────────────────────────
  const getTimeFromX = useCallback((clientX: number) => {
    const el = scrubRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return pct * duration
  }, [duration])

  const handleScrubStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsScrubbing(true)
    const t = getTimeFromX(e.clientX)
    const video = videoRef.current
    if (video) video.currentTime = t
    setCurrentTime(t)
  }, [getTimeFromX])

  const handleScrubMove = useCallback((e: MouseEvent) => {
    if (!isScrubbing) return
    const t = getTimeFromX(e.clientX)
    const video = videoRef.current
    if (video) video.currentTime = t
    setCurrentTime(t)
  }, [isScrubbing, getTimeFromX])

  const handleScrubEnd = useCallback(() => setIsScrubbing(false), [])

  useEffect(() => {
    if (isScrubbing) {
      window.addEventListener('mousemove', handleScrubMove)
      window.addEventListener('mouseup', handleScrubEnd)
      return () => {
        window.removeEventListener('mousemove', handleScrubMove)
        window.removeEventListener('mouseup', handleScrubEnd)
      }
    }
  }, [isScrubbing, handleScrubMove, handleScrubEnd])

  const handleScrubHover = useCallback((e: React.MouseEvent) => {
    setHoverX(e.clientX)
    setHoverTime(getTimeFromX(e.clientX))
  }, [getTimeFromX])

  // ── Helpers ─────────────────────────────────
  const seekTo = (t: number) => {
    const video = videoRef.current
    if (video) video.currentTime = Math.max(0, Math.min(duration, t))
  }

  const progress = duration > 0 ? currentTime / duration : 0
  const inPct    = duration > 0 ? inPt / duration * 100 : 0
  const outPct   = duration > 0 ? outPt / duration * 100 : 100

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full"
        style={{ background: '#06060c' }}>
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Play className="w-6 h-6 text-white/20" />
          </div>
          <p className="text-[13px] text-white/30">Select a clip to preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden min-h-0">
        <video
          ref={videoRef}
          className="max-w-full max-h-full object-contain"
          preload="auto"
          playsInline
        />

        {/* Clip name overlay */}
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg text-[11px] text-white/60 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
          {clip.fileName}
        </div>

        {/* Resolution badge */}
        {clip.info && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-[11px] text-white/50 pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)' }}>
            {clip.info.width}×{clip.info.height} · {clip.info.fps}fps · {clip.info.codec}
          </div>
        )}

        {/* Playback rate badge */}
        {playbackRate !== 1 && (
          <div className="absolute bottom-16 right-3 px-2 py-1 rounded-lg text-[13px] font-bold text-[#e4bc72]"
            style={{ background: 'rgba(0,0,0,0.6)' }}>
            {playbackRate}×
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex-shrink-0 px-4 pt-2 pb-3"
        style={{ background: 'rgba(6,6,12,0.95)', backdropFilter: 'blur(20px)' }}>

        {/* Scrub bar */}
        <div
          ref={scrubRef}
          className="relative h-7 flex items-center cursor-pointer mb-2 group"
          onMouseDown={handleScrubStart}
          onMouseMove={handleScrubHover}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Track */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            {/* Playback progress */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${progress * 100}%`, background: 'rgba(255,255,255,0.5)' }}
            />
            {/* In/out range highlight */}
            {(clip.inPointSet || clip.outPointSet) && (
              <div
                className="absolute inset-y-0 rounded-full"
                style={{
                  left: `${inPct}%`,
                  width: `${outPct - inPct}%`,
                  background: 'rgba(228,188,114,0.4)',
                  borderLeft: '2px solid rgba(52,211,153,0.9)',
                  borderRight: '2px solid rgba(251,113,133,0.9)',
                }}
              />
            )}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg z-10 transition-transform group-hover:scale-125"
            style={{ left: `${progress * 100}%` }}
          />

          {/* Marker dots */}
          {clip.markers.map((m) => (
            <div
              key={m.id}
              className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full z-10"
              style={{
                left: `${(m.timeSeconds / duration) * 100}%`,
                background: m.color,
                boxShadow: `0 0 4px ${m.color}`,
              }}
              title={m.label}
            />
          ))}

          {/* Hover time tooltip */}
          {hoverTime !== null && !isScrubbing && (
            <div
              className="absolute bottom-full mb-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono text-white -translate-x-1/2 pointer-events-none z-20"
              style={{
                left: hoverX - (scrubRef.current?.getBoundingClientRect().left ?? 0),
                background: 'rgba(0,0,0,0.85)',
                backdropFilter: 'blur(10px)',
              }}
            >
              {formatTimecode(hoverTime, fps)}
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2">
          {/* Transport left */}
          <div className="flex items-center gap-1">
            {/* Go to in */}
            <button
              onClick={() => seekTo(inPt)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              title="Go to In point (Home)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            {/* Frame back */}
            <button
              onClick={() => seekTo(currentTime - 1 / fps)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              title="Previous frame (←)"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl text-white hover:bg-white/10 transition-colors"
              title="Play/Pause (Space)"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>

            {/* Frame forward */}
            <button
              onClick={() => seekTo(currentTime + 1 / fps)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              title="Next frame (→)"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Go to out */}
            <button
              onClick={() => seekTo(outPt)}
              className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
              title="Go to Out point (End)"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-px h-4 bg-white/10" />

          {/* Timecode */}
          <span className="font-mono text-[12px] text-white/70 tabular-nums min-w-[96px]">
            {formatTimecode(currentTime, fps)}
          </span>
          <span className="text-white/20 text-[11px]">/</span>
          <span className="font-mono text-[11px] text-white/35 tabular-nums">
            {formatTimecode(duration, fps)}
          </span>

          <div className="flex-1" />

          {/* In/Out controls */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => clip && setInPoint(clip.id, currentTime)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                clip?.inPointSet ? 'text-[#34d399] bg-[#34d399]/10' : 'text-white/40 hover:text-[#34d399] hover:bg-[#34d399]/10'
              }`}
              title="Set In point (I)"
            >
              {clip?.inPointSet ? `I: ${formatTimecode(inPt, fps)}` : 'Set In'}
            </button>
            <button
              onClick={() => clip && setOutPoint(clip.id, currentTime)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                clip?.outPointSet ? 'text-[#f87171] bg-[#f87171]/10' : 'text-white/40 hover:text-[#f87171] hover:bg-[#f87171]/10'
              }`}
              title="Set Out point (O)"
            >
              {clip?.outPointSet ? `O: ${formatTimecode(outPt, fps)}` : 'Set Out'}
            </button>
            {(clip?.inPointSet || clip?.outPointSet) && (
              <>
                <span className="text-white/30 text-[10px] mx-1">
                  {formatDuration(outPt - inPt)}
                </span>
                <button
                  onClick={() => { clearInPoint(clip.id); clearOutPoint(clip.id) }}
                  className="p-1 rounded text-white/25 hover:text-white/60 transition-colors"
                  title="Clear In/Out (X)"
                >
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </div>

          <div className="w-px h-4 bg-white/10" />

          {/* Add marker */}
          <button
            onClick={() => clip && addMarker(clip.id, {
              id: `m_${Date.now()}`,
              timeSeconds: currentTime,
              label: `Marker ${(clip.markers.length + 1)}`,
              color: '#e4bc72',
            })}
            className="p-1.5 rounded-lg text-white/40 hover:text-[#e4bc72] hover:bg-[#e4bc72]/10 transition-colors"
            title="Add marker (M)"
          >
            <Bookmark className="w-3.5 h-3.5" />
          </button>

          {/* Loop */}
          <button
            onClick={() => setLoopInOut(!loopInOut)}
            className={`p-1.5 rounded-lg transition-colors ${
              loopInOut ? 'text-[#e4bc72] bg-[#e4bc72]/10' : 'text-white/40 hover:text-white/70'
            }`}
            title="Loop In/Out"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Playback rate */}
          <select
            value={playbackRate}
            onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="bg-transparent text-[11px] text-white/50 hover:text-white/80 border border-white/10 rounded-lg px-1.5 py-1 outline-none cursor-pointer"
          >
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r} style={{ background: '#14142e' }}>{r}×</option>
            ))}
          </select>

          {/* Volume */}
          <div className="flex items-center gap-1.5 relative">
            <button
              onClick={() => setVolume(volume === 0 ? 1 : 0)}
              onMouseEnter={() => setShowVolumeSlider(true)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white/80 transition-colors"
            >
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            {showVolumeSlider && (
              <div
                className="absolute bottom-full right-0 mb-2 p-2 rounded-xl"
                style={{ background: 'rgba(13,13,24,0.95)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <input
                  type="range"
                  min="0" max="1" step="0.01"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-24 h-1"
                />
                <p className="text-[10px] text-center text-white/40 mt-1">{Math.round(volume * 100)}%</p>
              </div>
            )}
          </div>

          {/* Add to timeline */}
          <button
            onClick={() => clip && addToTimeline(clip.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#e4bc72] transition-colors hover:bg-[#e4bc72]/10"
            title="Add to timeline (E)"
          >
            <Plus className="w-3.5 h-3.5" />
            Timeline
          </button>
        </div>
      </div>
    </div>
  )
}

// Tiny X icon since we can't import it above without conflict
function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
