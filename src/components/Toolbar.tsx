import React from 'react'
import { FolderOpen, FilePlus2, Download, Grid3x3, List, Film, Rows3, Clock, HardDrive } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import type { FilterMode, ViewMode } from '../types'
import { formatDuration, formatFileSize } from '../utils/timecode'

interface Props {
  onImport: () => void
  onImportFolder: () => void
  onExport: () => void
}

const FILTER_MODES: { mode: FilterMode; label: string }[] = [
  { mode: 'all',     label: 'All' },
  { mode: 'picks',   label: 'Picks' },
  { mode: 'review',  label: 'Review' },
  { mode: 'rejects', label: 'Rejects' },
  { mode: 'unrated', label: 'Unrated' },
]

export default function Toolbar({ onImport, onImportFolder, onExport }: Props) {
  const {
    filterMode, setFilterMode,
    viewMode, setViewMode,
    showTimeline, setShowTimeline,
    clips, timelineClips,
    getGroups, filterGroup, setFilterGroup,
    getFootageStats,
  } = useProjectStore()

  const groups = getGroups()
  const stats = getFootageStats()
  const timelineDuration = timelineClips.reduce((s, tc) => s + tc.duration, 0)

  return (
    <div
      className="no-drag flex items-center gap-1 px-3 h-10 border-b border-white/[0.06] flex-shrink-0 overflow-x-auto"
      style={{ background: 'rgba(13,13,24,0.8)', backdropFilter: 'blur(20px)' }}
    >
      {/* Import */}
      <button onClick={onImport} className="btn-apple flex items-center gap-1.5 flex-shrink-0" title="Import files (⌘I)">
        <FilePlus2 className="w-3.5 h-3.5" />
        <span>Import</span>
      </button>
      <button onClick={onImportFolder} className="btn-apple flex-shrink-0" title="Import folder (⌘⇧I)">
        <FolderOpen className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-white/10 mx-1 flex-shrink-0" />

      {/* Filter pills */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {FILTER_MODES.map(({ mode, label }) => (
          <button key={mode} onClick={() => setFilterMode(mode)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              filterMode === mode ? 'bg-white/15 text-white/90' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.05]'
            }`}>{label}</button>
        ))}
      </div>

      {/* Group filter */}
      {groups.length > 0 && (
        <>
          <div className="w-px h-4 bg-white/10 mx-1 flex-shrink-0" />
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={() => setFilterGroup(null)}
              className={`px-2 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
                !filterGroup ? 'bg-white/15 text-white/90' : 'text-white/40 hover:text-white/60'
              }`}>All</button>
            {groups.map((g) => (
              <button key={g} onClick={() => setFilterGroup(filterGroup === g ? null : g)}
                className={`px-2 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
                  filterGroup === g ? 'bg-[#e4bc72]/20 text-[#e4bc72]' : 'text-white/40 hover:text-white/60'
                }`}>{g}</button>
            ))}
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-2" />

      {/* ── Footage stats ── */}
      {clips.length > 0 && (
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Total footage */}
          <div className="flex items-center gap-1 text-[11px] text-white/30" title="Total footage duration">
            <Clock className="w-3 h-3" />
            <span>{formatDuration(stats.totalDuration)}</span>
          </div>

          {/* Picks */}
          {stats.picksCount > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-[#34d399]/70" title="Picks">
              <span className="text-[10px]">✓</span>
              <span>{stats.picksCount} pick{stats.picksCount !== 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Selected duration */}
          {timelineDuration > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-[#e4bc72]/70" title="Timeline duration">
              <Film className="w-3 h-3" />
              <span>{formatDuration(timelineDuration)}</span>
            </div>
          )}

          {/* File size */}
          {stats.totalSize > 0 && (
            <div className="flex items-center gap-1 text-[11px] text-white/25" title="Total file size">
              <HardDrive className="w-3 h-3" />
              <span>{formatFileSize(stats.totalSize)}</span>
            </div>
          )}

          <div className="w-px h-4 bg-white/10" />
        </div>
      )}

      {/* View mode */}
      <div className="flex items-center gap-0.5 mr-1 flex-shrink-0">
        {([['filmstrip', Film], ['list', List], ['icon', Grid3x3]] as [ViewMode, any][]).map(([mode, Icon]) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === mode ? 'bg-white/15 text-white/90' : 'text-white/35 hover:text-white/60'
            }`} title={`${mode} view`}>
            <Icon className="w-3.5 h-3.5" />
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-white/10 mx-1 flex-shrink-0" />

      {/* Timeline toggle */}
      <button onClick={() => setShowTimeline(!showTimeline)}
        className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${
          showTimeline ? 'bg-white/15 text-white/90' : 'text-white/35 hover:text-white/60'
        }`} title="Toggle timeline">
        <Rows3 className="w-3.5 h-3.5" />
      </button>

      <div className="w-px h-4 bg-white/10 mx-1 flex-shrink-0" />

      {/* Export */}
      <button onClick={onExport} className="btn-apple btn-apple-accent flex items-center gap-1.5 flex-shrink-0">
        <Download className="w-3.5 h-3.5" />
        <span>Export</span>
      </button>
    </div>
  )
}
