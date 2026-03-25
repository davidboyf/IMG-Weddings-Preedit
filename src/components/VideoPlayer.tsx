import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Maximize2, Minimize2, Repeat, Plus, Bookmark
} from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatTimecode, formatDuration } from '../utils/timecode'

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const THUMB_INTERVAL = 0.05  // fetch thumbnail every 5% of duration

function ArrowLeft({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
}
function ArrowRight({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
}

export default function VideoPlayer() {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const scrubRef    = useRef<HTMLDivElement>(null)
  const waveCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)

  const [isScrubbing, setIsScrubbing]       = useState(false)
  const [hoverTime, setHoverTime]           = useState<number | null>(null)
  const [hoverX, setHoverX]                 = useState(0)
  const [hoverThumb, setHoverThumb]         = useState<string | null>(null)
  const [thumbCache, setThumbCache]         = useState<Record<number, string>>({})
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [isFullscreen, setIsFullscreen]     = useState(false)

  const {
    selectedClipId, clips,
    currentTime, setCurrentTime,
    isPlaying, setIsPlaying,
    playbackRate, setPlaybackRate,
    loopInOut, setLoopInOut,
    volume, setVolume,
    setInPoint, setOutPoint, clearInPoint, clearOutPoint,
    addToTimeline, addMarker, updateClip,
  } = useProjectStore()

  const clip    = clips.find((c) => c.id === selectedClipId) ?? null
  const duration = clip?.info?.duration ?? 0
  const fps     = clip?.info?.fps ?? 24
  const inPt    = clip?.inPointSet  ? clip.inPoint  : 0
  const outPt   = clip?.outPointSet ? clip.outPoint : duration

  // ── Video src ──────────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video || !clip) return
    const src = clip.useProxy && clip.proxyPath ? clip.proxyPath : clip.filePath
    video.src = src.startsWith('file://') ? src : `file://${src}`
    video.currentTime = 0
    setCurrentTime(0)
    setIsPlaying(false)
  }, [clip?.filePath, clip?.useProxy, clip?.proxyPath])

  // ── Play/pause sync ────────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.playbackRate = Math.abs(playbackRate)
  }, [playbackRate])

  useEffect(() => {
    const video = videoRef.current
    if (video) video.volume = Math.min(1, Math.max(0, volume))
  }, [volume])

  // ── Time update + loop ─────────────────────
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (loopInOut && video.currentTime >= outPt) {
        video.currentTime = inPt
      }
    }
    const onEnded = () => {
      if (loopInOut) { video.currentTime = inPt; video.play() }
      else setIsPlaying(false)
    }
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
    }
  }, [loopInOut, inPt, outPt])

  // ── Draw waveform on scrub canvas ──────────
  useEffect(() => {
    const canvas = waveCanvasRef.current
    if (!canvas || !clip?.waveformPeaks?.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)
    const peaks = clip.waveformPeaks
    const barW  = width / peaks.length
    const playPct = duration > 0 ? currentTime / duration : 0

    peaks.forEach((peak, i) => {
      const x   = i * barW
      const pct = i / peaks.length
      const barH = peak * height * 0.42

      ctx.fillStyle = pct <= playPct ? 'rgba(228,188,114,0.55)' : 'rgba(255,255,255,0.12)'
      ctx.fillRect(x, height / 2 - barH, Math.max(1, barW - 0.5), barH)
      ctx.fillStyle = pct <= playPct ? 'rgba(228,188,114,0.22)' : 'rgba(255,255,255,0.05)'
      ctx.fillRect(x, height / 2, Math.max(1, barW - 0.5), barH * 0.5)
    })

    // In/out tint
    if (clip.inPointSet || clip.outPointSet) {
      const iX = (inPt  / duration) * width
      const oX = (outPt / duration) * width
      ctx.fillStyle = 'rgba(228,188,114,0.06)'
      ctx.fillRect(iX, 0, oX - iX, height)
    }
  }, [clip?.waveformPeaks, currentTime, inPt, outPt, duration])

  // ── Prefetch hover thumbnails ──────────────
  const prefetchThumbs = useCallback(async () => {
    if (!clip || !window.electronAPI) return
    const steps = Math.ceil(1 / THUMB_INTERVAL)
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * duration
      const key = Math.round(t * 10)
      if (thumbCache[key]) continue
      const thumb = await window.electronAPI.getThumbnail(clip.filePath, t)
      if (thumb) setThumbCache((prev) => ({ ...prev, [key]: thumb }))
    }
  }, [clip?.filePath, duration])

  useEffect(() => {
    prefetchThumbs()
  }, [clip?.id])

  const getHoverThumb = useCallback((t: number) => {
    const key = Math.round(Math.round(t / (duration * THUMB_INTERVAL)) * duration * THUMB_INTERVAL * 10)
    return thumbCache[key] ?? clip?.thumbnail ?? null
  }, [thumbCache, clip?.thumbnail, duration])

  // ── Keyboard shortcuts ─────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!clip) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); setIsPlaying(!isPlaying); break
        case 'j': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - (e.shiftKey ? 5 : 1/fps)); break
        case 'l': e.preventDefault(); video.currentTime = Math.min(duration, video.currentTime + (e.shiftKey ? 5 : 1/fps)); break
        case 'ArrowLeft': e.preventDefault(); seekTo(video.currentTime - (e.shiftKey ? 1 : 1/fps)); break
        case 'ArrowRight': e.preventDefault(); seekTo(video.currentTime + (e.shiftKey ? 1 : 1/fps)); break
        case 'i': e.preventDefault(); setInPoint(clip.id, video.currentTime); break
        case 'o': e.preventDefault(); setOutPoint(clip.id, video.currentTime); break
        case 'I': e.preventDefault(); clearInPoint(clip.id); break
        case 'O': e.preventDefault(); clearOutPoint(clip.id); break
        case 'x': e.preventDefault(); clearInPoint(clip.id); clearOutPoint(clip.id); break
        case 'e': e.preventDefault(); addToTimeline(clip.id); break
        case 'm': e.preventDefault(); addMarker(clip.id, { id: `m_${Date.now()}`, timeSeconds: video.currentTime, label: `Marker ${clip.markers.length + 1}`, color: '#e4bc72' }); break
        case 'p': e.preventDefault(); useProjectStore.getState().setFlag(clip.id, clip.flag === 'pick' ? 'none' : 'pick'); break
        case 'u': e.preventDefault(); useProjectStore.getState().setFlag(clip.id, 'none'); break
        case 'Home': e.preventDefault(); seekTo(inPt); break
        case 'End':  e.preventDefault(); seekTo(outPt); break
        case 'f': if (e.metaKey) { e.preventDefault(); toggleFullscreen() } break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clip, isPlaying, fps, duration, inPt, outPt])

  // ── Scrub bar ──────────────────────────────
  const getTimeFromX = useCallback((clientX: number) => {
    const el = scrubRef.current
    if (!el || !duration) return 0
    const rect = el.getBoundingClientRect()
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration))
  }, [duration])

  const handleScrubStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsScrubbing(true)
    const t = getTimeFromX(e.clientX)
    const video = videoRef.current
    if (video) video.currentTime = t
    setCurrentTime(t)
  }, [getTimeFromX])

  useEffect(() => {
    if (!isScrubbing) return
    const onMove = (e: MouseEvent) => {
      const t = getTimeFromX(e.clientX)
      const video = videoRef.current
      if (video) video.currentTime = t
      setCurrentTime(t)
    }
    const onUp = () => setIsScrubbing(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isScrubbing, getTimeFromX])

  const handleScrubHover = useCallback((e: React.MouseEvent) => {
    const t = getTimeFromX(e.clientX)
    setHoverTime(t)
    setHoverX(e.clientX)
    setHoverThumb(getHoverThumb(t))
  }, [getTimeFromX, getHoverThumb])

  // ── Fullscreen ─────────────────────────────
  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true))
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false))
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const seekTo = (t: number) => {
    const video = videoRef.current
    if (video) video.currentTime = Math.max(0, Math.min(duration, t))
  }

  const progress = duration > 0 ? currentTime / duration : 0
  const inPct    = duration > 0 ? (inPt  / duration) * 100 : 0
  const outPct   = duration > 0 ? (outPt / duration) * 100 : 100

  // Load waveform on first play if not loaded
  useEffect(() => {
    if (isPlaying && clip && !clip.waveformPeaks && window.electronAPI) {
      window.electronAPI.getWaveform(clip.filePath, 600).then((peaks) => {
        if (peaks?.length) updateClip(clip.id, { waveformPeaks: peaks })
      })
    }
  }, [isPlaying, clip?.id])

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full" style={{ background: '#06060c' }}>
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
    <div ref={containerRef} className="flex flex-col h-full bg-black group/player">
      {/* Video */}
      <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden min-h-0"
        onDoubleClick={toggleFullscreen}>
        <video ref={videoRef} className="max-w-full max-h-full object-contain" preload="auto" playsInline />

        {/* Top-left info */}
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg text-[11px] text-white/60 pointer-events-none opacity-0 group-hover/player:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}>
          {clip.fileName}
          {clip.useProxy && <span className="ml-1.5 text-[#e4bc72]">PROXY</span>}
        </div>

        {/* Top-right codec info */}
        {clip.info && (
          <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-[11px] text-white/50 pointer-events-none opacity-0 group-hover/player:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}>
            {clip.info.width}×{clip.info.height} · {clip.info.fps}fps · {clip.info.codec?.toUpperCase()}
          </div>
        )}

        {/* Playback rate badge */}
        {playbackRate !== 1 && (
          <div className="absolute bottom-14 right-3 px-2 py-1 rounded-lg text-[14px] font-bold text-[#e4bc72]"
            style={{ background: 'rgba(0,0,0,0.65)' }}>
            {playbackRate}×
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex-shrink-0 px-4 pt-1.5 pb-3"
        style={{ background: 'rgba(6,6,12,0.97)', backdropFilter: 'blur(20px)' }}>

        {/* Waveform + scrub bar combined */}
        <div
          ref={scrubRef}
          className="relative cursor-pointer mb-1.5 select-none"
          style={{ height: 36 }}
          onMouseDown={handleScrubStart}
          onMouseMove={handleScrubHover}
          onMouseLeave={() => { setHoverTime(null); setHoverThumb(null) }}
        >
          {/* Waveform canvas */}
          <canvas
            ref={waveCanvasRef}
            width={1200}
            height={72}
            className="absolute inset-0 w-full h-full"
            style={{ imageRendering: 'pixelated', opacity: clip.waveformPeaks ? 1 : 0, transition: 'opacity 0.3s' }}
          />

          {/* Track bg (shown when no waveform) */}
          {!clip.waveformPeaks && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)' }} />
          )}

          {/* Progress fill (on top of waveform) */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-0.5 pointer-events-none"
            style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
              style={{ width: `${progress * 100}%` }} />
          </div>

          {/* In/out zone */}
          {(clip.inPointSet || clip.outPointSet) && (
            <div className="absolute top-0 bottom-0 pointer-events-none rounded"
              style={{
                left: `${inPct}%`,
                width: `${outPct - inPct}%`,
                borderLeft: '2px solid rgba(52,211,153,0.8)',
                borderRight: '2px solid rgba(248,113,113,0.8)',
                background: clip.waveformPeaks ? 'rgba(228,188,114,0.06)' : 'rgba(228,188,114,0.12)',
              }} />
          )}

          {/* Markers */}
          {clip.markers.map((m) => (
            <div key={m.id} className="absolute top-0 bottom-0 w-0.5 pointer-events-none"
              style={{ left: `${(m.timeSeconds / duration) * 100}%`, background: m.color }}>
              <div className="w-1.5 h-1.5 rounded-full -translate-x-1/4"
                style={{ background: m.color, boxShadow: `0 0 4px ${m.color}` }} />
            </div>
          ))}

          {/* Playhead */}
          <div className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${progress * 100}%` }}>
            <div className="w-0.5 h-full bg-white/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-white -translate-x-[4px] -translate-y-[0px] shadow-lg"
              style={{ position: 'absolute', top: '50%', transform: 'translate(-4px, -50%)' }} />
          </div>

          {/* Hover thumbnail + timecode */}
          {hoverTime !== null && !isScrubbing && (
            <div
              className="absolute bottom-full mb-2 pointer-events-none z-20"
              style={{ left: hoverX - (scrubRef.current?.getBoundingClientRect().left ?? 0) - 48 }}
            >
              {hoverThumb && (
                <img src={hoverThumb} alt=""
                  className="w-24 h-14 object-cover rounded-lg mb-1 shadow-xl"
                  style={{ border: '1px solid rgba(255,255,255,0.15)' }} />
              )}
              <div className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white text-center"
                style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}>
                {formatTimecode(hoverTime, fps)}
              </div>
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-1.5">
          {/* Transport */}
          <button onClick={() => seekTo(inPt)} className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors" title="Go to In (Home)">
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => seekTo(currentTime - 1/fps)} className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors" title="Prev frame (←)">
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 rounded-xl text-white hover:bg-white/10 transition-colors" title="Play/Pause (Space)">
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button onClick={() => seekTo(currentTime + 1/fps)} className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors" title="Next frame (→)">
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => seekTo(outPt)} className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors" title="Go to Out (End)">
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-white/10" />

          {/* Timecode */}
          <span className="font-mono text-[12px] text-white/70 tabular-nums min-w-[96px]">
            {formatTimecode(currentTime, fps)}
          </span>
          <span className="text-white/20 text-[10px]">/</span>
          <span className="font-mono text-[10px] text-white/35 tabular-nums">{formatTimecode(duration, fps)}</span>

          <div className="flex-1" />

          {/* In/Out */}
          <button onClick={() => setInPoint(clip.id, currentTime)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              clip.inPointSet ? 'text-[#34d399] bg-[#34d399]/10' : 'text-white/40 hover:text-[#34d399] hover:bg-[#34d399]/10'
            }`} title="Set In (I)">
            {clip.inPointSet ? `I: ${formatTimecode(inPt, fps)}` : 'Set In'}
          </button>
          <button onClick={() => setOutPoint(clip.id, currentTime)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              clip.outPointSet ? 'text-[#f87171] bg-[#f87171]/10' : 'text-white/40 hover:text-[#f87171] hover:bg-[#f87171]/10'
            }`} title="Set Out (O)">
            {clip.outPointSet ? `O: ${formatTimecode(outPt, fps)}` : 'Set Out'}
          </button>
          {(clip.inPointSet || clip.outPointSet) && (
            <>
              <span className="text-[10px] text-white/30 font-mono">{formatDuration(outPt - inPt)}</span>
              <button onClick={() => { clearInPoint(clip.id); clearOutPoint(clip.id) }}
                className="p-1 rounded text-white/25 hover:text-white/60 transition-colors" title="Clear I/O (X)">
                <XIcon className="w-3 h-3" />
              </button>
            </>
          )}

          <div className="w-px h-4 bg-white/10" />

          {/* Marker */}
          <button onClick={() => addMarker(clip.id, { id: `m_${Date.now()}`, timeSeconds: currentTime, label: `Marker ${clip.markers.length + 1}`, color: '#e4bc72' })}
            className="p-1.5 rounded-lg text-white/40 hover:text-[#e4bc72] hover:bg-[#e4bc72]/10 transition-colors" title="Add marker (M)">
            <Bookmark className="w-3.5 h-3.5" />
          </button>

          {/* Loop */}
          <button onClick={() => setLoopInOut(!loopInOut)}
            className={`p-1.5 rounded-lg transition-colors ${loopInOut ? 'text-[#e4bc72] bg-[#e4bc72]/10' : 'text-white/40 hover:text-white/70'}`}
            title="Loop In/Out">
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Rate */}
          <select value={playbackRate} onChange={(e) => setPlaybackRate(Number(e.target.value))}
            className="bg-transparent text-[11px] text-white/50 hover:text-white/80 border border-white/10 rounded-lg px-1.5 py-1 outline-none cursor-pointer">
            {PLAYBACK_RATES.map((r) => (
              <option key={r} value={r} style={{ background: '#14142e' }}>{r}×</option>
            ))}
          </select>

          {/* Volume */}
          <div className="relative">
            <button onClick={() => setVolume(volume === 0 ? 1 : 0)}
              onMouseEnter={() => setShowVolumeSlider(true)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white/80 transition-colors">
              {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            {showVolumeSlider && (
              <div className="absolute bottom-full right-0 mb-2 p-3 rounded-xl"
                style={{ background: 'rgba(13,13,24,0.96)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)' }}
                onMouseLeave={() => setShowVolumeSlider(false)}>
                <input type="range" min="0" max="1" step="0.01" value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))} className="w-24" />
                <p className="text-[10px] text-center text-white/40 mt-1">{Math.round(volume * 100)}%</p>
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            title="Fullscreen (⌘F / double-click video)">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Add to timeline */}
          <button onClick={() => addToTimeline(clip.id)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[#e4bc72] hover:bg-[#e4bc72]/10 transition-colors"
            title="Add to timeline (E)">
            <Plus className="w-3.5 h-3.5" />
            Timeline
          </button>
        </div>
      </div>
    </div>
  )
}
