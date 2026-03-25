import React, { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, Music, RefreshCw } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatDuration } from '../utils/timecode'

export default function AudioPanel() {
  const { getSelectedClip, updateClip, currentTime, clips } = useProjectStore()
  const clip = getSelectedClip()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loadingWaveform, setLoadingWaveform] = useState(false)

  // ── Load waveform ───────────────────────────
  useEffect(() => {
    if (!clip || clip.waveformPeaks) return
    if (!window.electronAPI) return

    setLoadingWaveform(true)
    window.electronAPI.getWaveform(clip.filePath, 800).then((peaks) => {
      if (peaks?.length) {
        updateClip(clip.id, { waveformPeaks: peaks })
      }
      setLoadingWaveform(false)
    }).catch(() => setLoadingWaveform(false))
  }, [clip?.id])

  // ── Draw waveform ───────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !clip?.waveformPeaks?.length) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const peaks = clip.waveformPeaks
    const barWidth = width / peaks.length
    const midY = height / 2
    const duration = clip.info?.duration ?? 0
    const playheadPct = duration > 0 ? currentTime / duration : 0

    peaks.forEach((peak, i) => {
      const x = i * barWidth
      const barH = peak * midY * 0.9
      const pct = i / peaks.length
      const isPast = pct <= playheadPct

      // Color
      ctx.fillStyle = isPast
        ? 'rgba(228,188,114,0.8)'
        : 'rgba(255,255,255,0.18)'

      // Bar above center
      ctx.fillRect(x, midY - barH, Math.max(1, barWidth - 0.5), barH)
      // Mirror below
      ctx.fillStyle = isPast
        ? 'rgba(228,188,114,0.35)'
        : 'rgba(255,255,255,0.07)'
      ctx.fillRect(x, midY, Math.max(1, barWidth - 0.5), barH * 0.6)
    })

    // Playhead line
    ctx.strokeStyle = 'rgba(228,188,114,0.9)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    const px = playheadPct * width
    ctx.moveTo(px, 0)
    ctx.lineTo(px, height)
    ctx.stroke()
  }, [clip?.waveformPeaks, currentTime])

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[12px] text-white/25">No clip selected</p>
      </div>
    )
  }

  const volume = clip.volume ?? 1
  const balance = clip.audioBalance ?? 0

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Waveform */}
      <div className="rounded-xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-white/50">Waveform</span>
          {loadingWaveform ? (
            <RefreshCw className="w-3 h-3 text-white/30 animate-spin" />
          ) : clip.waveformPeaks ? (
            <span className="text-[10px] text-white/25">{clip.waveformPeaks.length} samples</span>
          ) : (
            <button
              onClick={() => updateClip(clip.id, { waveformPeaks: null })}
              className="text-[10px] text-white/30 hover:text-white/60"
            >
              Load
            </button>
          )}
        </div>

        {clip.waveformPeaks ? (
          <canvas
            ref={canvasRef}
            width={800}
            height={100}
            className="w-full"
            style={{ imageRendering: 'pixelated' }}
          />
        ) : (
          <div className="h-24 flex items-center justify-center">
            {loadingWaveform ? (
              <div className="flex items-center gap-2 text-white/30 text-[11px]">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Extracting audio…
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Music className="w-5 h-5 text-white/15" />
                <span className="text-[10px] text-white/25">Click Load to generate waveform</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Audio info */}
      {clip.info?.audioCodec && (
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Codec', clip.info.audioCodec.toUpperCase()],
            ['Channels', String(clip.info.audioChannels || 2)],
            ['Sample Rate', `${(clip.info.audioSampleRate / 1000).toFixed(1)} kHz`],
            ['Duration', formatDuration(clip.info.duration)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg p-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] text-white/35 mb-0.5">{label}</p>
              <p className="text-[12px] font-medium text-white/75">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Volume */}
      <div className="rounded-xl p-3 space-y-3"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[11px] font-medium text-white/50">Audio Adjustments</p>

        {/* Volume */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[12px] text-white/60">Volume</span>
            </div>
            <span className="text-[12px] font-mono text-white/60">
              {volume >= 1
                ? `+${((volume - 1) * 100).toFixed(0)}%`
                : `-${((1 - volume) * 100).toFixed(0)}%`}
              {' '}({Math.round(volume * 100)}%)
            </span>
          </div>
          <input
            type="range" min="0" max="2" step="0.01"
            value={volume}
            onChange={(e) => updateClip(clip.id, { volume: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
            <span>0%</span>
            <span className="text-white/40">100%</span>
            <span>200%</span>
          </div>
        </div>

        {/* Balance */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12px] text-white/60">Balance</span>
            <span className="text-[12px] font-mono text-white/60">
              {balance === 0 ? 'C' : balance < 0 ? `L${Math.abs(Math.round(balance * 100))}` : `R${Math.round(balance * 100)}`}
            </span>
          </div>
          <input
            type="range" min="-1" max="1" step="0.01"
            value={balance}
            onChange={(e) => updateClip(clip.id, { audioBalance: Number(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
            <span>L</span>
            <span className="text-white/40">C</span>
            <span>R</span>
          </div>
        </div>

        {/* Reset */}
        {(volume !== 1 || balance !== 0) && (
          <button
            onClick={() => updateClip(clip.id, { volume: 1, audioBalance: 0 })}
            className="text-[11px] text-white/35 hover:text-white/60 transition-colors"
          >
            Reset to defaults
          </button>
        )}
      </div>

      {/* VU Meter (animated bars) */}
      <VUMeter />
    </div>
  )
}

// ──────────────────────────────────────────────
// VU Meter (decorative real-time)
// ──────────────────────────────────────────────
function VUMeter() {
  const { isPlaying } = useProjectStore()
  const [levels, setLevels] = useState([0.3, 0.3])
  const rafRef = useRef<number>()
  const t = useRef(0)

  useEffect(() => {
    if (!isPlaying) {
      setLevels([0, 0])
      return
    }
    const animate = () => {
      t.current += 0.08
      const l = Math.max(0.05, Math.min(0.95,
        0.5 + Math.sin(t.current * 1.3) * 0.25 + Math.sin(t.current * 3.7) * 0.12 + Math.random() * 0.08
      ))
      const r = Math.max(0.05, Math.min(0.95,
        0.5 + Math.sin(t.current * 1.1 + 0.5) * 0.25 + Math.sin(t.current * 2.9) * 0.12 + Math.random() * 0.08
      ))
      setLevels([l, r])
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [isPlaying])

  return (
    <div className="rounded-xl p-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] text-white/35 mb-2">VU Meter</p>
      <div className="flex gap-2">
        {['L', 'R'].map((ch, i) => (
          <div key={ch} className="flex-1">
            <div className="relative h-3 rounded-full overflow-hidden mb-1"
              style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-75"
                style={{
                  width: `${levels[i] * 100}%`,
                  background: levels[i] > 0.85
                    ? '#f87171'
                    : levels[i] > 0.7
                    ? '#fbbf24'
                    : 'rgba(228,188,114,0.8)',
                }}
              />
            </div>
            <span className="text-[9px] text-white/25">{ch}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
