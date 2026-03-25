import React, { useState } from 'react'
import { Film, Plus, Trash2 } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatDuration, formatFileSize, formatBitrate, formatTimecode } from '../utils/timecode'
import type { ClipRating, ClipFlag, ColorLabel, TransitionType } from '../types'
import { COLOR_LABEL_HEX, DEFAULT_COLOR } from '../types'
import SubclipPanel from './SubclipPanel'

const FLAG_OPTIONS: { value: ClipFlag; label: string; color: string; active: string }[] = [
  { value: 'pick',   label: 'Pick',   color: 'text-[#34d399]', active: 'bg-[#34d399]/15 text-[#34d399]' },
  { value: 'review', label: 'Review', color: 'text-[#fbbf24]', active: 'bg-[#fbbf24]/15 text-[#fbbf24]' },
  { value: 'reject', label: 'Reject', color: 'text-[#f87171]', active: 'bg-[#f87171]/15 text-[#f87171]' },
]

const GROUPS = ['Ceremony', 'Reception', 'Getting Ready', 'First Look', 'Details', 'Speeches', 'Dance', 'Portraits', 'Other']
const COLOR_LABELS: ColorLabel[] = ['none', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple']

const TRANSITION_TYPES: { value: TransitionType; label: string }[] = [
  { value: 'none',      label: 'None' },
  { value: 'fade',      label: 'Fade' },
  { value: 'dissolve',  label: 'Dissolve' },
  { value: 'wipeleft',  label: 'Wipe Left' },
  { value: 'wiperight', label: 'Wipe Right' },
  { value: 'slideleft', label: 'Slide Left' },
]

type InspectorTab = 'info' | 'subclips' | 'edit'

// ── Range slider row ──────────────────────────
function SliderRow({
  label, value, min, max, step, displayValue, onChange, disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  displayValue: string
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-white/40">{label}</span>
        <span className="text-[10px] text-white/60 font-mono tabular-nums">{displayValue}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full disabled:opacity-40"
      />
    </div>
  )
}

export default function InspectorPanel() {
  const {
    getSelectedClip, updateClip,
    setRating, setFlag, setColorLabel,
    setInPoint, setOutPoint, clearInPoint, clearOutPoint,
    addToTimeline, removeMarker,
    currentTime, settings,
    selectedTimelineClipId, timelineClips,
    setTimelineClipSpeed, setTimelineClipColor, setTimelineClipTransition,
    setTimelineClipVolume,
  } = useProjectStore()

  const [tab, setTab] = useState<InspectorTab>('info')

  const clip = getSelectedClip()
  const fps  = clip?.info?.fps ?? settings.frameRate

  // Find selected timeline clip
  const selectedTC = selectedTimelineClipId
    ? timelineClips.find((tc) => tc.id === selectedTimelineClipId) ?? null
    : null

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[12px] text-white/25">Select a clip</p>
      </div>
    )
  }

  const info = clip.info

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex border-b border-white/[0.05] flex-shrink-0">
        {(['info', 'subclips', 'edit'] as InspectorTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-[11px] font-medium capitalize transition-colors ${
              tab === t ? 'text-white/80 border-b border-[#e4bc72]/60' : 'text-white/35 hover:text-white/55'
            }`}>
            {t === 'info' ? 'Info' : t === 'subclips'
              ? `Subclips${clip.subClips.length > 0 ? ` (${clip.subClips.length})` : ''}`
              : 'Edit'}
          </button>
        ))}
      </div>

      {/* Tab: Subclips */}
      {tab === 'subclips' && <SubclipPanel />}

      {/* Tab: Edit */}
      {tab === 'edit' && (
        <div className="flex flex-col gap-4 p-3 overflow-y-auto flex-1 pb-6">
          {!selectedTC ? (
            <div className="flex items-center justify-center h-24">
              <p className="text-[12px] text-white/25">Select a clip on the timeline</p>
            </div>
          ) : (
            <>
              {/* Speed */}
              <div className="rounded-xl p-3 space-y-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Speed</p>
                <SliderRow
                  label="Speed"
                  value={selectedTC.speed ?? 1}
                  min={0.25} max={4.0} step={0.05}
                  displayValue={`${(selectedTC.speed ?? 1).toFixed(2)}×`}
                  onChange={(v) => setTimelineClipSpeed(selectedTC.id, v)}
                />
                {/* Preset buttons */}
                <div className="flex gap-1.5 flex-wrap">
                  {[0.25, 0.5, 1, 2].map((s) => (
                    <button key={s} onClick={() => setTimelineClipSpeed(selectedTC.id, s)}
                      className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                        (selectedTC.speed ?? 1) === s
                          ? 'bg-[#e4bc72]/20 text-[#e4bc72] border border-[#e4bc72]/30'
                          : 'bg-white/[0.04] text-white/35 border border-white/[0.06] hover:text-white/60'
                      }`}>{s}×</button>
                  ))}
                </div>
              </div>

              {/* Color Correction */}
              <div className="rounded-xl p-3 space-y-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Color</p>
                  <button
                    onClick={() => setTimelineClipColor(selectedTC.id, { ...DEFAULT_COLOR })}
                    className="text-[10px] text-white/30 hover:text-white/60 transition-colors">
                    Reset
                  </button>
                </div>
                <SliderRow
                  label="Brightness"
                  value={selectedTC.color?.brightness ?? 0}
                  min={-0.5} max={0.5} step={0.01}
                  displayValue={(selectedTC.color?.brightness ?? 0).toFixed(2)}
                  onChange={(v) => setTimelineClipColor(selectedTC.id, { brightness: v })}
                />
                <SliderRow
                  label="Contrast"
                  value={selectedTC.color?.contrast ?? 1}
                  min={0.5} max={2.0} step={0.01}
                  displayValue={(selectedTC.color?.contrast ?? 1).toFixed(2)}
                  onChange={(v) => setTimelineClipColor(selectedTC.id, { contrast: v })}
                />
                <SliderRow
                  label="Saturation"
                  value={selectedTC.color?.saturation ?? 1}
                  min={0} max={2.0} step={0.01}
                  displayValue={(selectedTC.color?.saturation ?? 1).toFixed(2)}
                  onChange={(v) => setTimelineClipColor(selectedTC.id, { saturation: v })}
                />
              </div>

              {/* Transitions */}
              <div className="rounded-xl p-3 space-y-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Transitions</p>

                {/* Transition In */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/35">In</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedTC.transitionIn?.type ?? 'none'}
                      onChange={(e) => setTimelineClipTransition(selectedTC.id, 'in', e.target.value as TransitionType, selectedTC.transitionIn?.duration ?? 0)}
                      className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white/70 outline-none focus:border-[#e4bc72]/40"
                    >
                      {TRANSITION_TYPES.map((t) => (
                        <option key={t.value} value={t.value} style={{ background: '#06060c' }}>{t.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={3} step={0.1}
                        value={(selectedTC.transitionIn?.duration ?? 0).toFixed(1)}
                        onChange={(e) => setTimelineClipTransition(selectedTC.id, 'in', selectedTC.transitionIn?.type ?? 'none', Number(e.target.value))}
                        className="w-14 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white/70 outline-none focus:border-[#e4bc72]/40 text-center"
                        disabled={selectedTC.transitionIn?.type === 'none'}
                      />
                      <span className="text-[10px] text-white/30">s</span>
                    </div>
                  </div>
                </div>

                {/* Transition Out */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-white/35">Out</p>
                  <div className="flex gap-2">
                    <select
                      value={selectedTC.transitionOut?.type ?? 'none'}
                      onChange={(e) => setTimelineClipTransition(selectedTC.id, 'out', e.target.value as TransitionType, selectedTC.transitionOut?.duration ?? 0)}
                      className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white/70 outline-none focus:border-[#e4bc72]/40"
                    >
                      {TRANSITION_TYPES.map((t) => (
                        <option key={t.value} value={t.value} style={{ background: '#06060c' }}>{t.label}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min={0} max={3} step={0.1}
                        value={(selectedTC.transitionOut?.duration ?? 0).toFixed(1)}
                        onChange={(e) => setTimelineClipTransition(selectedTC.id, 'out', selectedTC.transitionOut?.type ?? 'none', Number(e.target.value))}
                        className="w-14 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[11px] text-white/70 outline-none focus:border-[#e4bc72]/40 text-center"
                        disabled={selectedTC.transitionOut?.type === 'none'}
                      />
                      <span className="text-[10px] text-white/30">s</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Volume */}
              <div className="rounded-xl p-3 space-y-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">Volume</p>
                <SliderRow
                  label="Clip Volume"
                  value={selectedTC.volume ?? 1}
                  min={0} max={2} step={0.01}
                  displayValue={`${Math.round((selectedTC.volume ?? 1) * 100)}%`}
                  onChange={(v) => setTimelineClipVolume(selectedTC.id, v)}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Info */}
      {tab === 'info' && (
        <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1 pb-6">

          {/* Thumbnail */}
          <div className="rounded-xl overflow-hidden aspect-video bg-black/40 relative flex-shrink-0">
            {clip.thumbnail
              ? <img src={clip.thumbnail} alt={clip.fileName} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-white/15" /></div>
            }
            <div className="absolute bottom-0 inset-x-0 px-2 py-1.5"
              style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.8))' }}>
              <p className="text-[11px] font-medium text-white/90 truncate">{clip.fileName}</p>
              {info && <p className="text-[10px] text-white/50">{info.width}×{info.height} · {info.fps}fps · {info.codec?.toUpperCase()}</p>}
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setRating(clip.id, (n === clip.rating ? 0 : n) as ClipRating)}
                  className={`text-xl transition-colors ${n <= clip.rating ? 'text-[#e4bc72]' : 'text-white/15 hover:text-[#e4bc72]/60'}`}>
                  ★
                </button>
              ))}
            </div>

            {/* Flag */}
            <div className="flex gap-1">
              {FLAG_OPTIONS.map(({ value, label, active }) => (
                <button key={value} onClick={() => setFlag(clip.id, clip.flag === value ? 'none' : value)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                    clip.flag === value ? active : 'text-white/30 hover:text-white/60'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Color label */}
          <div>
            <p className="text-[10px] text-white/35 mb-1.5">Color Label</p>
            <div className="flex gap-1.5 items-center">
              {COLOR_LABELS.map((l) => (
                <button key={l} onClick={() => setColorLabel(clip.id, l)}
                  className="rounded-full transition-all hover:scale-110"
                  style={{
                    width: 14, height: 14,
                    background: l === 'none' ? 'rgba(255,255,255,0.08)' : COLOR_LABEL_HEX[l],
                    border: clip.colorLabel === l ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: clip.colorLabel === l && l !== 'none' ? `0 0 6px ${COLOR_LABEL_HEX[l]}` : 'none',
                  }}
                  title={l}
                />
              ))}
              {clip.colorLabel !== 'none' && (
                <span className="text-[10px] text-white/40 ml-1 capitalize">{clip.colorLabel}</span>
              )}
            </div>
          </div>

          {/* In/Out */}
          <div className="rounded-xl p-3 space-y-2"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider">In / Out Points</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setInPoint(clip.id, currentTime)}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                  clip.inPointSet ? 'bg-[#34d399]/10 border border-[#34d399]/30' : 'bg-white/[0.04] border border-white/[0.06] hover:bg-[#34d399]/5'
                }`}>
                <span className="text-[9px] text-[#34d399]/70 mb-0.5">IN  (I)</span>
                <span className={`font-mono text-[10px] ${clip.inPointSet ? 'text-[#34d399]' : 'text-white/30'}`}>
                  {clip.inPointSet ? formatTimecode(clip.inPoint, fps) : '—'}
                </span>
              </button>
              <button onClick={() => setOutPoint(clip.id, currentTime)}
                className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                  clip.outPointSet ? 'bg-[#f87171]/10 border border-[#f87171]/30' : 'bg-white/[0.04] border border-white/[0.06] hover:bg-[#f87171]/5'
                }`}>
                <span className="text-[9px] text-[#f87171]/70 mb-0.5">OUT  (O)</span>
                <span className={`font-mono text-[10px] ${clip.outPointSet ? 'text-[#f87171]' : 'text-white/30'}`}>
                  {clip.outPointSet ? formatTimecode(clip.outPoint, fps) : '—'}
                </span>
              </button>
            </div>
            {(clip.inPointSet || clip.outPointSet) && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/50">
                  Duration: <span className="text-white/70 font-mono">
                    {formatDuration((clip.outPointSet ? clip.outPoint : (info?.duration ?? 0)) - (clip.inPointSet ? clip.inPoint : 0))}
                  </span>
                </span>
                <button onClick={() => { clearInPoint(clip.id); clearOutPoint(clip.id) }}
                  className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">Clear</button>
              </div>
            )}
          </div>

          {/* Group */}
          <div>
            <p className="text-[10px] text-white/35 mb-1.5">Group / Scene</p>
            <div className="flex flex-wrap gap-1">
              {GROUPS.map((g) => (
                <button key={g} onClick={() => updateClip(clip.id, { group: clip.group === g ? '' : g })}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                    clip.group === g
                      ? 'bg-[#e4bc72]/20 text-[#e4bc72] border border-[#e4bc72]/30'
                      : 'bg-white/[0.04] text-white/35 border border-white/[0.06] hover:text-white/60'
                  }`}>{g}</button>
              ))}
            </div>
          </div>

          {/* Reel */}
          <div>
            <p className="text-[10px] text-white/35 mb-1">Reel / Camera</p>
            <input type="text" value={clip.reelName} onChange={(e) => updateClip(clip.id, { reelName: e.target.value })}
              placeholder="e.g. A001, Cam1…"
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-white/75 outline-none focus:border-[#e4bc72]/40" />
          </div>

          {/* Notes */}
          <div>
            <p className="text-[10px] text-white/35 mb-1">Notes</p>
            <textarea value={clip.notes} onChange={(e) => updateClip(clip.id, { notes: e.target.value })}
              placeholder="Add notes about this clip…" rows={2}
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] text-white/75 outline-none focus:border-[#e4bc72]/40 resize-none" />
          </div>

          {/* Markers */}
          {clip.markers.length > 0 && (
            <div className="rounded-xl p-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-medium text-white/40 mb-2">Markers ({clip.markers.length})</p>
              <div className="space-y-1">
                {clip.markers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 group">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: m.color }} />
                    <span className="font-mono text-[10px] text-white/50 flex-shrink-0">{formatTimecode(m.timeSeconds, fps)}</span>
                    <input type="text" value={m.label}
                      onChange={(e) => {
                        const markers = clip.markers.map((mk) => mk.id === m.id ? { ...mk, label: e.target.value } : mk)
                        updateClip(clip.id, { markers })
                      }}
                      className="flex-1 bg-transparent text-[11px] text-white/60 outline-none min-w-0" />
                    <button onClick={() => removeMarker(clip.id, m.id)}
                      className="p-0.5 opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technical */}
          {info && (
            <div className="rounded-xl p-3 space-y-1.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[10px] font-medium text-white/30 uppercase tracking-wider mb-2">Technical</p>
              {[
                ['Duration',    formatDuration(info.duration)],
                ['Resolution',  `${info.width}×${info.height}`],
                ['Frame Rate',  `${info.fps} fps`],
                ['Video',       info.codec?.toUpperCase() ?? '—'],
                ['Audio',       info.audioCodec ? `${info.audioCodec.toUpperCase()} · ${info.audioChannels}ch · ${(info.audioSampleRate/1000).toFixed(1)}kHz` : 'None'],
                ['Bitrate',     formatBitrate(info.bitrate)],
                ['File Size',   formatFileSize(info.size)],
                ...(info.createdAt ? [['Recorded', new Date(info.createdAt).toLocaleDateString()]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-2">
                  <span className="text-[10px] text-white/28 flex-shrink-0">{label}</span>
                  <span className="text-[10px] text-white/60 text-right break-all">{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Add to timeline */}
          <button onClick={() => addToTimeline(clip.id)}
            className="btn-apple btn-apple-accent flex items-center justify-center gap-2 py-2.5">
            <Plus className="w-4 h-4" />Add to Timeline (E)
          </button>
        </div>
      )}
    </div>
  )
}
