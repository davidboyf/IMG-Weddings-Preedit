import React from 'react'
import { useProjectStore } from '../stores/useProjectStore'

interface Props {
  onSettings: () => void
  onSave: () => void
  onImport: () => void
  onExport: () => void
}

export default function TitleBar({ onSettings, onSave }: Props) {
  const { settings, isDirty, projectPath } = useProjectStore()

  return (
    <div
      className="drag-region flex items-center h-11 px-4 border-b border-white/[0.06] flex-shrink-0"
      style={{ background: 'rgba(6,6,12,0.95)', backdropFilter: 'blur(40px)' }}
    >
      {/* Traffic lights space */}
      <div className="w-16 flex-shrink-0" />

      {/* Project name — centered */}
      <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
        <span className="text-[13px] font-medium text-white/80 tracking-tight truncate">
          {settings.name}
          {settings.couple ? ` — ${settings.couple}` : ''}
        </span>
        {isDirty && (
          <div className="w-1.5 h-1.5 rounded-full bg-[#e4bc72] flex-shrink-0" title="Unsaved changes" />
        )}
      </div>

      {/* Right controls */}
      <div className="no-drag flex items-center gap-2 flex-shrink-0">
        {projectPath && (
          <span className="text-[11px] text-white/25 font-mono hidden xl:block truncate max-w-32">
            {projectPath.split('/').pop()}
          </span>
        )}
        <button
          onClick={onSave}
          className="text-[12px] font-medium text-white/40 hover:text-white/70 px-2 py-1 rounded-md hover:bg-white/[0.05] transition-colors"
        >
          {isDirty ? 'Save•' : 'Saved'}
        </button>
        <button
          onClick={onSettings}
          className="text-[12px] font-medium text-white/40 hover:text-white/70 px-2 py-1 rounded-md hover:bg-white/[0.05] transition-colors"
        >
          Settings
        </button>
      </div>
    </div>
  )
}
