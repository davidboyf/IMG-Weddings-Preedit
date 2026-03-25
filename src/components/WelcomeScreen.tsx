import React from 'react'
import { Film, FolderOpen, FilePlus2, Clock } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import type { RecentProject } from '../types'

interface Props {
  onImport: () => void
  onImportFolder: () => void
  onOpenProject: () => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (days > 0)  return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (mins > 0)  return `${mins}m ago`
  return 'just now'
}

export default function WelcomeScreen({ onImport, onImportFolder, onOpenProject }: Props) {
  const { recentProjects, updateSettings } = useProjectStore()

  const handleOpenRecent = async (project: RecentProject) => {
    const api = window.electronAPI
    try {
      const json = await api.readFile(project.path)
      const data = JSON.parse(json)
      useProjectStore.getState().loadProject({
        settings: data.settings,
        clips: data.clips,
        timelineClips: data.timeline,
        projectPath: project.path,
      })
    } catch (e) {
      console.error('Failed to open recent project:', e)
    }
  }

  return (
    <div className="flex items-center justify-center h-full"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(228,188,114,0.04) 0%, transparent 70%)' }}>
      <div className="flex flex-col items-center max-w-lg w-full px-8 gap-8">
        {/* Logo */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-4 flex items-center justify-center"
            style={{
              background: 'rgba(228,188,114,0.08)',
              border: '1px solid rgba(228,188,114,0.15)',
              boxShadow: '0 0 40px rgba(228,188,114,0.1)',
            }}>
            <Film className="w-9 h-9 text-[#e4bc72]" />
          </div>
          <h1 className="text-[22px] font-semibold text-white/90 tracking-tight">IMG Weddings Preedit</h1>
          <p className="text-[13px] text-white/40 mt-1">Wedding footage pre-editing suite</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {[
            { icon: FilePlus2, label: 'Import Files', sub: '⌘I', onClick: onImport },
            { icon: FolderOpen, label: 'Import Folder', sub: '⌘⇧I', onClick: onImportFolder },
            { icon: Clock, label: 'Open Project', sub: '⌘O', onClick: onOpenProject },
          ].map(({ icon: Icon, label, sub, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all group"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(228,188,114,0.1)' }}>
                <Icon className="w-5 h-5 text-[#e4bc72]" />
              </div>
              <div className="text-center">
                <p className="text-[12px] font-medium text-white/75">{label}</p>
                <p className="text-[10px] text-white/25">{sub}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="w-full">
            <p className="text-[11px] font-medium text-white/35 uppercase tracking-wider mb-2">Recent Projects</p>
            <div className="space-y-1">
              {recentProjects.slice(0, 5).map((project) => (
                <button
                  key={project.path}
                  onClick={() => handleOpenRecent(project)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors group"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(228,188,114,0.08)' }}>
                    <Film className="w-4 h-4 text-[#e4bc72]/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-white/75 truncate">{project.name}</p>
                    <p className="text-[10px] text-white/35">
                      {project.couple && `${project.couple} · `}
                      {project.clipCount} clip{project.clipCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-white/30">{timeAgo(project.savedAt)}</p>
                    <p className="text-[9px] text-white/20 font-mono truncate max-w-24">{project.path.split('/').pop()}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tip */}
        <p className="text-[11px] text-white/20 text-center">
          Drag video files anywhere on this window to import · Press <kbd className="px-1 py-0.5 rounded bg-white/8 text-white/35 text-[10px]">?</kbd> for keyboard shortcuts
        </p>
      </div>
    </div>
  )
}
