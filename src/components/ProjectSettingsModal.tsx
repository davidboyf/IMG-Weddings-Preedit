import React from 'react'
import { X, FolderOpen } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'

interface Props {
  onClose: () => void
}

const FRAME_RATES = [23.976, 24, 25, 29.97, 30, 47.952, 48, 50, 59.94, 60]
const RESOLUTIONS = [
  { label: '4K DCI (4096×2160)', w: 4096, h: 2160 },
  { label: '4K UHD (3840×2160)', w: 3840, h: 2160 },
  { label: '2K (2048×1080)', w: 2048, h: 1080 },
  { label: '1080p (1920×1080)', w: 1920, h: 1080 },
  { label: '720p (1280×720)', w: 1280, h: 720 },
]

export default function ProjectSettingsModal({ onClose }: Props) {
  const { settings, updateSettings } = useProjectStore()

  const handleBrowseOutput = async () => {
    const folder = await window.electronAPI.openFolder()
    if (folder) updateSettings({ outputDir: folder })
  }

  const currentRes = RESOLUTIONS.find(
    (r) => r.w === settings.resolution.width && r.h === settings.resolution.height
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'rgba(13,13,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(40px)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-[15px] font-semibold text-white/90">Project Settings</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Project name */}
          <Field label="Project Name">
            <input
              type="text"
              value={settings.name}
              onChange={(e) => updateSettings({ name: e.target.value })}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/85 outline-none focus:border-[#e4bc72]/40"
              placeholder="Wedding Project Name"
            />
          </Field>

          {/* Couple */}
          <Field label="Couple">
            <input
              type="text"
              value={settings.couple}
              onChange={(e) => updateSettings({ couple: e.target.value })}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/85 outline-none focus:border-[#e4bc72]/40"
              placeholder="e.g. Emma & James"
            />
          </Field>

          {/* Event date */}
          <Field label="Event Date">
            <input
              type="date"
              value={settings.eventDate}
              onChange={(e) => updateSettings({ eventDate: e.target.value })}
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/85 outline-none focus:border-[#e4bc72]/40"
            />
          </Field>

          {/* Frame rate */}
          <Field label="Frame Rate">
            <select
              value={settings.frameRate}
              onChange={(e) => updateSettings({ frameRate: Number(e.target.value) })}
              className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/85 outline-none focus:border-[#e4bc72]/40"
            >
              {FRAME_RATES.map((fps) => (
                <option key={fps} value={fps}>{fps} fps</option>
              ))}
            </select>
          </Field>

          {/* Resolution */}
          <Field label="Sequence Resolution">
            <select
              value={`${settings.resolution.width}x${settings.resolution.height}`}
              onChange={(e) => {
                const res = RESOLUTIONS.find((r) => `${r.w}x${r.h}` === e.target.value)
                if (res) updateSettings({ resolution: { width: res.w, height: res.h } })
              }}
              className="w-full bg-[#1a1a2e] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white/85 outline-none focus:border-[#e4bc72]/40"
            >
              {RESOLUTIONS.map((r) => (
                <option key={r.label} value={`${r.w}x${r.h}`}>{r.label}</option>
              ))}
            </select>
          </Field>

          {/* Output directory */}
          <Field label="Output Folder">
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.outputDir}
                onChange={(e) => updateSettings({ outputDir: e.target.value })}
                placeholder="/Users/you/Desktop/Wedding"
                className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-white/70 outline-none focus:border-[#e4bc72]/40 min-w-0 font-mono"
              />
              <button
                onClick={handleBrowseOutput}
                className="btn-apple flex items-center gap-1.5 flex-shrink-0 px-3"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Browse
              </button>
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/[0.07]">
          <button onClick={onClose} className="btn-apple px-4 py-2 text-[12px]">Cancel</button>
          <button onClick={onClose} className="btn-apple btn-apple-accent px-4 py-2 text-[12px]">Save Settings</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-white/40 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
