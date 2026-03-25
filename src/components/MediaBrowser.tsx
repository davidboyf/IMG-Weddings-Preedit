import React, { useState, useRef, useCallback } from 'react'
import {
  Search, X, MoreHorizontal, Trash2, Star, Film,
  CheckCircle, XCircle, Eye, Clock, HardDrive, Tag
} from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import type { MediaClip, ClipRating, ClipFlag } from '../types'
import { formatDuration, formatFileSize } from '../utils/timecode'

interface Props {
  onImport: () => void
  onImportFolder: () => void
}

// ──────────────────────────────────────────────
// Clip card (filmstrip view)
// ──────────────────────────────────────────────
function ClipCard({ clip, isSelected, onClick }: { clip: MediaClip; isSelected: boolean; onClick: () => void }) {
  const { setRating, setFlag, removeClip } = useProjectStore()
  const [hovered, setHovered] = useState(false)

  const flagColors: Record<ClipFlag, string> = {
    none:    '',
    pick:    'border-t-2 border-[#34d399]',
    reject:  'border-t-2 border-[#f87171]',
    review:  'border-t-2 border-[#fbbf24]',
  }

  return (
    <div
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-150 group
        ${flagColors[clip.flag]}
        ${isSelected
          ? 'ring-2 ring-[#e4bc72] ring-offset-1 ring-offset-[#06060c]'
          : 'hover:ring-1 hover:ring-white/20'}
      `}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black/60 overflow-hidden">
        {clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt={clip.fileName}
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-6 h-6 text-white/20" />
          </div>
        )}

        {/* Duration badge */}
        {clip.info && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-white/90"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            {formatDuration(clip.info.duration)}
          </div>
        )}

        {/* In/out badge */}
        {(clip.inPointSet || clip.outPointSet) && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[#e4bc72]"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            I/O
          </div>
        )}

        {/* Hover actions */}
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center gap-2"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setFlag(clip.id, clip.flag === 'pick' ? 'none' : 'pick') }}
              className={`p-1.5 rounded-lg transition-colors ${clip.flag === 'pick' ? 'bg-[#34d399]/20 text-[#34d399]' : 'bg-white/10 text-white/60 hover:text-[#34d399]'}`}
            >
              <CheckCircle className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setFlag(clip.id, clip.flag === 'reject' ? 'none' : 'reject') }}
              className={`p-1.5 rounded-lg transition-colors ${clip.flag === 'reject' ? 'bg-[#f87171]/20 text-[#f87171]' : 'bg-white/10 text-white/60 hover:text-[#f87171]'}`}
            >
              <XCircle className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); removeClip(clip.id) }}
              className="p-1.5 rounded-lg bg-white/10 text-white/40 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-2 py-1.5">
        <p className="text-[12px] font-medium text-white/80 truncate leading-tight">{clip.fileName}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-[10px] text-white/35 truncate">
            {clip.info ? `${clip.info.width}×${clip.info.height} · ${clip.info.fps}fps` : 'Loading…'}
          </p>
          {/* Stars */}
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={(e) => { e.stopPropagation(); setRating(clip.id, n as ClipRating) }}
                className={`text-[10px] transition-colors ${n <= clip.rating ? 'text-[#e4bc72]' : 'text-white/15 hover:text-white/40'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Group tag */}
        {clip.group && (
          <span className="inline-block mt-1 px-1.5 py-0 rounded text-[10px] text-[#e4bc72]/80"
            style={{ background: 'rgba(228,188,114,0.08)' }}>
            {clip.group}
          </span>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// List row
// ──────────────────────────────────────────────
function ClipRow({ clip, isSelected, onClick }: { clip: MediaClip; isSelected: boolean; onClick: () => void }) {
  const { setRating, setFlag, removeClip } = useProjectStore()

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group rounded-lg mx-2 my-0.5 ${
        isSelected ? 'bg-[#e4bc72]/10 ring-1 ring-[#e4bc72]/30' : 'hover:bg-white/[0.04]'
      }`}
      onClick={onClick}
    >
      {/* Thumb */}
      <div className="w-14 aspect-video rounded-md overflow-hidden flex-shrink-0 bg-black/40">
        {clip.thumbnail ? (
          <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-4 h-4 text-white/20" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white/85 truncate">{clip.fileName}</p>
        <p className="text-[10px] text-white/35">
          {clip.info ? `${formatDuration(clip.info.duration)} · ${clip.info.width}×${clip.info.height}` : '…'}
        </p>
      </div>

      {/* Flag dot */}
      {clip.flag !== 'none' && (
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          clip.flag === 'pick' ? 'bg-[#34d399]' :
          clip.flag === 'reject' ? 'bg-[#f87171]' : 'bg-[#fbbf24]'
        }`} />
      )}

      {/* Stars */}
      <div className="flex gap-0.5 flex-shrink-0">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={(e) => { e.stopPropagation(); setRating(clip.id, n as ClipRating) }}
            className={`text-[11px] transition-colors ${n <= clip.rating ? 'text-[#e4bc72]' : 'text-white/12 group-hover:text-white/25'}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// MediaBrowser
// ──────────────────────────────────────────────
export default function MediaBrowser({ onImport, onImportFolder }: Props) {
  const {
    selectedClipId, selectClip, viewMode,
    searchQuery, setSearchQuery,
    getFilteredClips,
    setSortField, sortField,
  } = useProjectStore()

  const clips = getFilteredClips()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <Search className="w-3.5 h-3.5 text-white/35 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clips…"
            className="flex-1 bg-transparent text-[12px] text-white/80 placeholder:text-white/25 outline-none min-w-0"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-white/30 hover:text-white/60">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Sort row */}
      <div className="flex items-center gap-1 px-3 pb-1.5 flex-shrink-0">
        {(['name', 'duration', 'rating', 'date'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setSortField(f)}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors capitalize ${
              sortField === f ? 'text-white/80 bg-white/10' : 'text-white/30 hover:text-white/50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Clip count */}
      {clips.length > 0 && (
        <div className="px-3 pb-1.5 flex-shrink-0">
          <span className="text-[10px] text-white/25">{clips.length} clip{clips.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Clips */}
      <div className="flex-1 overflow-y-auto">
        {clips.length === 0 ? (
          <EmptyState onImport={onImport} onImportFolder={onImportFolder} />
        ) : viewMode === 'list' ? (
          <div className="pb-4">
            {clips.map((clip) => (
              <ClipRow
                key={clip.id}
                clip={clip}
                isSelected={clip.id === selectedClipId}
                onClick={() => selectClip(clip.id)}
              />
            ))}
          </div>
        ) : (
          <div className={`grid gap-2 px-3 pb-4 ${viewMode === 'icon' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {clips.map((clip) => (
              <ClipCard
                key={clip.id}
                clip={clip}
                isSelected={clip.id === selectedClipId}
                onClick={() => selectClip(clip.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Empty state
// ──────────────────────────────────────────────
function EmptyState({ onImport, onImportFolder }: { onImport: () => void; onImportFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Film className="w-7 h-7 text-white/25" />
      </div>
      <div>
        <p className="text-[13px] font-medium text-white/60 mb-1">No footage yet</p>
        <p className="text-[11px] text-white/30 leading-relaxed">
          Drag video files here, or import from your drive.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <button onClick={onImport} className="btn-apple btn-apple-accent text-[12px] w-full py-2">
          Import Files…
        </button>
        <button onClick={onImportFolder} className="btn-apple text-[12px] w-full py-2">
          Import Folder…
        </button>
      </div>
    </div>
  )
}
