import React, { useState, useCallback } from 'react'
import { Search, X, Trash2, Film, CheckCircle, XCircle, Star } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import type { MediaClip, ClipRating, ClipFlag, ColorLabel } from '../types'
import { COLOR_LABEL_HEX } from '../types'
import { formatDuration } from '../utils/timecode'
import ContextMenu, { ContextMenuEntry } from './ContextMenu'

interface Props {
  onImport: () => void
  onImportFolder: () => void
}

// ── Color label dot ──────────────────────────
function ColorDot({ label, size = 8 }: { label: ColorLabel; size?: number }) {
  if (label === 'none') return null
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{ width: size, height: size, background: COLOR_LABEL_HEX[label], boxShadow: `0 0 4px ${COLOR_LABEL_HEX[label]}80` }}
    />
  )
}

// ── Color label picker ──────────────────────
function ColorLabelPicker({ current, onChange }: { current: ColorLabel; onChange: (l: ColorLabel) => void }) {
  const labels: ColorLabel[] = ['none', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple']
  return (
    <div className="flex gap-1 items-center">
      {labels.map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className="rounded-full transition-transform hover:scale-110"
          style={{
            width: 12, height: 12,
            background: l === 'none' ? 'rgba(255,255,255,0.1)' : COLOR_LABEL_HEX[l],
            border: current === l ? '2px solid white' : '1px solid rgba(255,255,255,0.2)',
          }}
          title={l}
        />
      ))}
    </div>
  )
}

// ── Filmstrip clip card ──────────────────────
function ClipCard({
  clip, isSelected, isMultiSelected, onClick, onContextMenu,
}: {
  clip: MediaClip
  isSelected: boolean
  isMultiSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { setRating, setFlag, setColorLabel } = useProjectStore()
  const [hovered, setHovered] = useState(false)

  const flagBorder: Record<ClipFlag, string> = {
    none:   '',
    pick:   'border-t-2 border-[#34d399]',
    reject: 'border-t-2 border-[#f87171]',
    review: 'border-t-2 border-[#fbbf24]',
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/clip-id', clip.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-150 group
        ${flagBorder[clip.flag]}
        ${isSelected ? 'ring-2 ring-[#e4bc72] ring-offset-1 ring-offset-[#06060c]' : ''}
        ${isMultiSelected && !isSelected ? 'ring-2 ring-blue-400/60 ring-offset-1 ring-offset-[#06060c]' : ''}
        ${!isSelected && !isMultiSelected ? 'hover:ring-1 hover:ring-white/20' : ''}
      `}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-black/60 overflow-hidden">
        {clip.thumbnail ? (
          <img src={clip.thumbnail} alt={clip.fileName} className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-6 h-6 text-white/20" />
          </div>
        )}

        {/* Color label strip top-right */}
        {clip.colorLabel !== 'none' && (
          <div className="absolute top-1.5 right-1.5">
            <ColorDot label={clip.colorLabel} size={10} />
          </div>
        )}

        {/* Duration badge */}
        {clip.info && (
          <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-white/90"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            {formatDuration(clip.info.duration)}
          </div>
        )}

        {/* I/O badge */}
        {(clip.inPointSet || clip.outPointSet) && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-[#e4bc72]"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            I/O
          </div>
        )}

        {/* Subclips badge */}
        {clip.subClips.length > 0 && (
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] text-white/60"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            {clip.subClips.length} sub
          </div>
        )}

        {/* Proxy badge */}
        {clip.proxyStatus === 'ready' && clip.useProxy && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] text-[#e4bc72]"
            style={{ background: 'rgba(0,0,0,0.7)' }}>
            PROXY
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 flex items-center justify-center gap-2"
            style={{ background: 'rgba(0,0,0,0.45)' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setFlag(clip.id, clip.flag === 'pick' ? 'none' : 'pick') }}
              className={`p-1.5 rounded-lg transition-colors ${clip.flag === 'pick' ? 'bg-[#34d399]/20 text-[#34d399]' : 'bg-white/10 text-white/60 hover:text-[#34d399]'}`}
            ><CheckCircle className="w-4 h-4" /></button>
            <button
              onClick={(e) => { e.stopPropagation(); setFlag(clip.id, clip.flag === 'reject' ? 'none' : 'reject') }}
              className={`p-1.5 rounded-lg transition-colors ${clip.flag === 'reject' ? 'bg-[#f87171]/20 text-[#f87171]' : 'bg-white/10 text-white/60 hover:text-[#f87171]'}`}
            ><XCircle className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="px-2 py-1.5">
        <p className="text-[12px] font-medium text-white/80 truncate leading-tight">{clip.fileName}</p>
        <div className="flex items-center justify-between mt-0.5 gap-1">
          <p className="text-[10px] text-white/35 truncate">
            {clip.info ? `${clip.info.width}×${clip.info.height}` : 'Loading…'}
          </p>
          <div className="flex gap-0.5 flex-shrink-0">
            {[1,2,3,4,5].map((n) => (
              <button key={n} onClick={(e) => { e.stopPropagation(); setRating(clip.id, n as ClipRating) }}
                className={`text-[10px] transition-colors ${n <= clip.rating ? 'text-[#e4bc72]' : 'text-white/15 hover:text-white/40'}`}>★</button>
            ))}
          </div>
        </div>
        {clip.group && (
          <span className="inline-block mt-0.5 px-1.5 py-0 rounded text-[10px] text-[#e4bc72]/80"
            style={{ background: 'rgba(228,188,114,0.08)' }}>{clip.group}</span>
        )}
      </div>
    </div>
  )
}

// ── List row ─────────────────────────────────
function ClipRow({
  clip, isSelected, isMultiSelected, onClick, onContextMenu,
}: {
  clip: MediaClip
  isSelected: boolean
  isMultiSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const { setRating, setFlag } = useProjectStore()

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/clip-id', clip.id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group rounded-lg mx-2 my-0.5 ${
        isSelected ? 'bg-[#e4bc72]/10 ring-1 ring-[#e4bc72]/30' :
        isMultiSelected ? 'bg-blue-400/10 ring-1 ring-blue-400/30' :
        'hover:bg-white/[0.04]'
      }`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {/* Color dot */}
      <ColorDot label={clip.colorLabel} size={7} />

      {/* Thumb */}
      <div className="w-14 aspect-video rounded-md overflow-hidden flex-shrink-0 bg-black/40">
        {clip.thumbnail
          ? <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" draggable={false} />
          : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4 text-white/20" /></div>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-white/85 truncate">{clip.fileName}</p>
        <p className="text-[10px] text-white/35">
          {clip.info ? `${formatDuration(clip.info.duration)} · ${clip.info.width}×${clip.info.height}` : '…'}
          {clip.subClips.length > 0 && ` · ${clip.subClips.length} sub`}
        </p>
      </div>

      {/* Flag dot */}
      {clip.flag !== 'none' && (
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          clip.flag === 'pick' ? 'bg-[#34d399]' : clip.flag === 'reject' ? 'bg-[#f87171]' : 'bg-[#fbbf24]'
        }`} />
      )}

      {/* Stars */}
      <div className="flex gap-0.5 flex-shrink-0">
        {[1,2,3,4,5].map((n) => (
          <button key={n}
            onClick={(e) => { e.stopPropagation(); setRating(clip.id, n as ClipRating) }}
            className={`text-[11px] transition-colors ${n <= clip.rating ? 'text-[#e4bc72]' : 'text-white/12 group-hover:text-white/25'}`}>
            ★
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Batch action bar ──────────────────────────
function BatchBar({ count }: { count: number }) {
  const {
    batchSetFlag, batchSetRating, batchSetColorLabel, batchAddToTimeline,
    removeClips, selectedClipIds, clearMultiSelect,
  } = useProjectStore()

  const COLOR_LABELS: ColorLabel[] = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple']

  return (
    <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
      style={{ background: 'rgba(60,60,100,0.35)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-[11px] font-medium text-white/60">{count} selected</span>
      <div className="w-px h-3 bg-white/15" />

      {/* Flag */}
      <button onClick={() => batchSetFlag('pick')}
        className="px-2 py-0.5 rounded text-[10px] text-[#34d399] hover:bg-[#34d399]/10 transition-colors">Pick</button>
      <button onClick={() => batchSetFlag('reject')}
        className="px-2 py-0.5 rounded text-[10px] text-[#f87171] hover:bg-[#f87171]/10 transition-colors">Reject</button>
      <button onClick={() => batchSetFlag('none')}
        className="px-2 py-0.5 rounded text-[10px] text-white/40 hover:bg-white/[0.05] transition-colors">Clear</button>

      <div className="w-px h-3 bg-white/15" />

      {/* Color labels */}
      {COLOR_LABELS.map((l) => (
        <button key={l} onClick={() => batchSetColorLabel(l)}
          className="rounded-full transition-transform hover:scale-110"
          style={{ width: 10, height: 10, background: COLOR_LABEL_HEX[l] }} />
      ))}
      <button onClick={() => batchSetColorLabel('none')}
        className="w-2.5 h-2.5 rounded-full border border-white/20 hover:border-white/50 transition-colors" />

      <div className="w-px h-3 bg-white/15" />

      {/* Add to timeline */}
      <button onClick={batchAddToTimeline}
        className="px-2 py-0.5 rounded text-[10px] text-[#e4bc72] hover:bg-[#e4bc72]/10 transition-colors">+ Timeline</button>

      {/* Delete */}
      <button onClick={() => removeClips(selectedClipIds)}
        className="px-2 py-0.5 rounded text-[10px] text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors">Delete</button>

      <div className="flex-1" />
      <button onClick={clearMultiSelect} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">✕ Deselect</button>
    </div>
  )
}

// ── MediaBrowser ─────────────────────────────
export default function MediaBrowser({ onImport, onImportFolder }: Props) {
  const {
    selectedClipId, selectClip, viewMode,
    searchQuery, setSearchQuery,
    getFilteredClips, setSortField, sortField,
    selectedClipIds, toggleSelectClip, selectRange, selectAll, clearMultiSelect,
    removeClip, setFlag, setColorLabel, setRating, addToTimeline,
  } = useProjectStore()

  const clips = getFilteredClips()

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; clipId: string } | null>(null)
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)

  const handleClipClick = useCallback((clip: MediaClip, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedId) {
      selectRange(lastClickedId, clip.id)
    } else if (e.metaKey || e.ctrlKey) {
      toggleSelectClip(clip.id, true)
    } else {
      selectClip(clip.id)
      clearMultiSelect()
    }
    setLastClickedId(clip.id)
  }, [lastClickedId, selectRange, toggleSelectClip, selectClip, clearMultiSelect])

  const handleContextMenu = useCallback((clip: MediaClip, e: React.MouseEvent) => {
    e.preventDefault()
    // If not already selected, select it
    if (!selectedClipIds.includes(clip.id) && selectedClipId !== clip.id) {
      selectClip(clip.id)
      clearMultiSelect()
    }
    setContextMenu({ x: e.clientX, y: e.clientY, clipId: clip.id })
  }, [selectedClipIds, selectedClipId, selectClip, clearMultiSelect])

  const buildContextMenuItems = useCallback((clipId: string): ContextMenuEntry[] => {
    const clip = useProjectStore.getState().clips.find((c) => c.id === clipId)
    if (!clip) return []
    const multi = selectedClipIds.length > 1
    const label = multi ? `${selectedClipIds.length} clips` : `"${clip.fileName}"`

    const colorLabels: ColorLabel[] = ['none', 'red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple']

    return [
      { label: `Add to Timeline`, onClick: () => addToTimeline(clipId) },
      { separator: true },
      { label: 'Flag as Pick',   onClick: () => multi ? useProjectStore.getState().batchSetFlag('pick')   : setFlag(clipId, 'pick') },
      { label: 'Flag as Review', onClick: () => multi ? useProjectStore.getState().batchSetFlag('review') : setFlag(clipId, 'review') },
      { label: 'Flag as Reject', onClick: () => multi ? useProjectStore.getState().batchSetFlag('reject') : setFlag(clipId, 'reject') },
      { label: 'Clear Flag',     onClick: () => multi ? useProjectStore.getState().batchSetFlag('none')   : setFlag(clipId, 'none') },
      { separator: true },
      { label: 'Color Label', onClick: () => {} , disabled: true },
      ...colorLabels.map((l) => ({
        label: `  ${l === 'none' ? 'None' : l.charAt(0).toUpperCase() + l.slice(1)}`,
        onClick: () => multi ? useProjectStore.getState().batchSetColorLabel(l) : setColorLabel(clipId, l),
      } as ContextMenuEntry)),
      { separator: true },
      {
        label: `Show in Finder`,
        onClick: () => window.electronAPI.showInFinder(clip.filePath),
      },
      { separator: true },
      {
        label: multi ? `Remove ${selectedClipIds.length} clips` : 'Remove from Library',
        onClick: () => {
          if (multi) {
            useProjectStore.getState().removeClips(selectedClipIds)
          } else {
            removeClip(clipId)
          }
        },
        danger: true,
      },
    ]
  }, [selectedClipIds, setFlag, setColorLabel, addToTimeline, removeClip])

  const multiCount = selectedClipIds.length

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
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
          <button key={f} onClick={() => setSortField(f)}
            className={`px-2 py-0.5 rounded text-[11px] transition-colors capitalize ${
              sortField === f ? 'text-white/80 bg-white/10' : 'text-white/30 hover:text-white/50'
            }`}>{f}</button>
        ))}
        {clips.length > 0 && (
          <>
            <div className="flex-1" />
            <button onClick={selectAll} className="text-[10px] text-white/25 hover:text-white/50 transition-colors">All</button>
          </>
        )}
      </div>

      {/* Batch action bar */}
      {multiCount > 1 && <BatchBar count={multiCount} />}

      {/* Clip count */}
      {clips.length > 0 && multiCount <= 1 && (
        <div className="px-3 pb-1 flex-shrink-0">
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
                isMultiSelected={selectedClipIds.includes(clip.id)}
                onClick={(e) => handleClipClick(clip, e)}
                onContextMenu={(e) => handleContextMenu(clip, e)}
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
                isMultiSelected={selectedClipIds.includes(clip.id)}
                onClick={(e) => handleClipClick(clip, e)}
                onContextMenu={(e) => handleContextMenu(clip, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems(contextMenu.clipId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

function EmptyState({ onImport, onImportFolder }: { onImport: () => void; onImportFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <Film className="w-7 h-7 text-white/25" />
      </div>
      <div>
        <p className="text-[13px] font-medium text-white/60 mb-1">No footage yet</p>
        <p className="text-[11px] text-white/30 leading-relaxed">Drag video files here, or import from your drive.</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        <button onClick={onImport} className="btn-apple btn-apple-accent text-[12px] w-full py-2">Import Files…</button>
        <button onClick={onImportFolder} className="btn-apple text-[12px] w-full py-2">Import Folder…</button>
      </div>
    </div>
  )
}
