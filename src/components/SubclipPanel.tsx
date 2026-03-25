import React from 'react'
import { Plus, Trash2, Film, CheckCircle, XCircle, Eye } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatTimecode, formatDuration } from '../utils/timecode'
import type { ClipFlag, SubClip } from '../types'

const FLAG_COLORS: Record<ClipFlag, string> = {
  none:   'text-white/40',
  pick:   'text-[#34d399]',
  reject: 'text-[#f87171]',
  review: 'text-[#fbbf24]',
}

export default function SubclipPanel() {
  const {
    getSelectedClip, addSubClip, updateSubClip, removeSubClip,
    addToTimeline, clips,
    currentTime, settings,
  } = useProjectStore()

  const clip = getSelectedClip()
  const fps = clip?.info?.fps ?? settings.frameRate

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[12px] text-white/25">No clip selected</p>
      </div>
    )
  }

  const handleAddSubClip = () => {
    const inPt  = clip.inPointSet  ? clip.inPoint  : 0
    const outPt = clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)
    const sc: SubClip = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: `Subclip ${clip.subClips.length + 1}`,
      inPoint: inPt,
      outPoint: outPt,
      flag: 'none',
      notes: '',
      addedAt: Date.now(),
    }
    addSubClip(clip.id, sc)
  }

  const handleAddSubClipAtCurrent = () => {
    const dur = clip.info?.duration ?? 0
    const sc: SubClip = {
      id: `sc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: `Subclip ${clip.subClips.length + 1}`,
      inPoint: Math.max(0, currentTime - 2),
      outPoint: Math.min(dur, currentTime + 2),
      flag: 'none',
      notes: '',
      addedAt: Date.now(),
    }
    addSubClip(clip.id, sc)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <div>
          <p className="text-[12px] font-medium text-white/70">Subclips</p>
          <p className="text-[10px] text-white/30">{clip.subClips.length} subclip{clip.subClips.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleAddSubClipAtCurrent}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
            title="Add subclip at current time"
          >
            <Plus className="w-3.5 h-3.5" />
            At playhead
          </button>
          <button
            onClick={handleAddSubClip}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-[#e4bc72] hover:bg-[#e4bc72]/10 transition-colors"
            title="Add subclip from In/Out"
          >
            <Plus className="w-3.5 h-3.5" />
            From I/O
          </button>
        </div>
      </div>

      {/* Subclip list */}
      <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
        {clip.subClips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Film className="w-8 h-8 text-white/15" />
            <div className="text-center">
              <p className="text-[12px] text-white/40 mb-1">No subclips yet</p>
              <p className="text-[11px] text-white/25 leading-relaxed">
                Set In/Out points on the clip, then click "From I/O" to create a subclip.
              </p>
            </div>
          </div>
        ) : (
          clip.subClips.map((sc) => (
            <SubclipRow
              key={sc.id}
              sc={sc}
              fps={fps}
              onUpdate={(patch) => updateSubClip(clip.id, sc.id, patch)}
              onRemove={() => removeSubClip(clip.id, sc.id)}
              onAddToTimeline={() => {
                // Temporarily set the clip's in/out to the subclip's points
                // then add to timeline, then restore
                useProjectStore.getState().setInPoint(clip.id, sc.inPoint)
                useProjectStore.getState().setOutPoint(clip.id, sc.outPoint)
                addToTimeline(clip.id)
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function SubclipRow({
  sc, fps, onUpdate, onRemove, onAddToTimeline,
}: {
  sc: SubClip
  fps: number
  onUpdate: (patch: Partial<SubClip>) => void
  onRemove: () => void
  onAddToTimeline: () => void
}) {
  const dur = sc.outPoint - sc.inPoint

  return (
    <div
      className="rounded-xl overflow-hidden group"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Top row */}
      <div className="flex items-center gap-2 px-2.5 pt-2.5 pb-1.5">
        {/* Name */}
        <input
          type="text"
          value={sc.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 bg-transparent text-[12px] font-medium text-white/80 outline-none min-w-0"
        />
        {/* Duration */}
        <span className="text-[10px] font-mono text-white/35 flex-shrink-0">{formatDuration(dur)}</span>
        {/* Delete */}
        <button
          onClick={onRemove}
          className="p-0.5 text-white/0 group-hover:text-white/30 hover:!text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Timecodes */}
      <div className="grid grid-cols-2 gap-1 px-2.5 pb-2">
        <div className="flex flex-col items-center p-1.5 rounded-lg"
          style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)' }}>
          <span className="text-[9px] text-[#34d399]/60 mb-0.5">IN</span>
          <span className="font-mono text-[10px] text-[#34d399]">{formatTimecode(sc.inPoint, fps)}</span>
        </div>
        <div className="flex flex-col items-center p-1.5 rounded-lg"
          style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <span className="text-[9px] text-[#f87171]/60 mb-0.5">OUT</span>
          <span className="font-mono text-[10px] text-[#f87171]">{formatTimecode(sc.outPoint, fps)}</span>
        </div>
      </div>

      {/* Flag + Add to timeline */}
      <div className="flex items-center justify-between px-2.5 pb-2.5">
        <div className="flex gap-1">
          {(['pick', 'review', 'reject'] as ClipFlag[]).map((f) => (
            <button
              key={f}
              onClick={() => onUpdate({ flag: sc.flag === f ? 'none' : f })}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                sc.flag === f ? `${FLAG_COLORS[f]} bg-white/10` : 'text-white/25 hover:text-white/50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={onAddToTimeline}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-[#e4bc72] hover:bg-[#e4bc72]/10 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Timeline
        </button>
      </div>
    </div>
  )
}
