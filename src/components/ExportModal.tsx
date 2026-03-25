import React, { useState } from 'react'
import { Download, X, Film, FileText, Table2, CheckCircle } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import type { ExportFormat } from '../types'

interface Props {
  onExport: (format: ExportFormat) => void
  onClose: () => void
}

const FORMATS: {
  id: ExportFormat
  name: string
  subtitle: string
  compat: string[]
  icon: React.ReactNode
  color: string
}[] = [
  {
    id: 'fcpxml',
    name: 'FCPXML 1.10',
    subtitle: 'Final Cut Pro X format — modern standard',
    compat: ['Final Cut Pro X', 'DaVinci Resolve 18+', 'Premiere (via plugin)'],
    icon: <Film className="w-5 h-5" />,
    color: '#34d399',
  },
  {
    id: 'xmeml',
    name: 'Premiere Pro XML',
    subtitle: 'FCP7 / XMEML — universal NLE format',
    compat: ['Adobe Premiere Pro', 'DaVinci Resolve', 'Avid Media Composer', 'Final Cut Pro 7'],
    icon: <Film className="w-5 h-5" />,
    color: '#60a5fa',
  },
  {
    id: 'edl',
    name: 'EDL (CMX 3600)',
    subtitle: 'Edit Decision List — works everywhere',
    compat: ['All NLEs', 'Color grading suites', 'Archiving'],
    icon: <FileText className="w-5 h-5" />,
    color: '#a78bfa',
  },
  {
    id: 'csv',
    name: 'CSV Log',
    subtitle: 'Spreadsheet log of all clips and selections',
    compat: ['Excel', 'Google Sheets', 'Numbers', 'Logging / billing'],
    icon: <Table2 className="w-5 h-5" />,
    color: '#e4bc72',
  },
]

export default function ExportModal({ onExport, onClose }: Props) {
  const { clips, timelineClips, settings } = useProjectStore()
  const [selected, setSelected] = useState<ExportFormat>('fcpxml')
  const [exporting, setExporting] = useState(false)

  const picks = clips.filter((c) => c.flag === 'pick').length
  const withInOut = clips.filter((c) => c.inPointSet || c.outPointSet).length
  const inTimeline = timelineClips.length
  const totalDuration = timelineClips.reduce((s, tc) => s + tc.duration, 0)

  const handleExport = async () => {
    setExporting(true)
    await onExport(selected)
    setExporting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden animate-scale-in"
        style={{
          background: 'rgba(13,13,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-[15px] font-semibold text-white/90">Export</h2>
            <p className="text-[12px] text-white/40 mt-0.5">{settings.name} — {settings.couple || 'Wedding'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b border-white/[0.05]">
          {[
            ['Total Clips', clips.length],
            ['Picks', picks],
            ['With I/O', withInOut],
            ['Timeline', inTimeline],
            ['Duration', `${Math.floor(totalDuration / 60)}m ${Math.floor(totalDuration % 60)}s`],
            ['FPS', settings.frameRate],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg p-2"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[10px] text-white/35">{label}</p>
              <p className="text-[13px] font-semibold text-white/80">{value}</p>
            </div>
          ))}
        </div>

        {/* Format selection */}
        <div className="p-5 space-y-2">
          <p className="text-[11px] text-white/40 mb-3">Choose export format</p>
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setSelected(fmt.id)}
              className={`w-full flex items-start gap-3 p-3.5 rounded-xl text-left transition-all ${
                selected === fmt.id
                  ? 'ring-1 ring-white/20'
                  : 'hover:bg-white/[0.03]'
              }`}
              style={{
                background: selected === fmt.id ? `${fmt.color}12` : 'rgba(255,255,255,0.03)',
                border: selected === fmt.id ? `1px solid ${fmt.color}30` : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="mt-0.5" style={{ color: fmt.color }}>{fmt.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-white/85">{fmt.name}</p>
                  {selected === fmt.id && <CheckCircle className="w-3.5 h-3.5" style={{ color: fmt.color }} />}
                </div>
                <p className="text-[11px] text-white/45 mt-0.5">{fmt.subtitle}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {fmt.compat.map((c) => (
                    <span key={c} className="px-1.5 py-0 rounded text-[10px] text-white/40"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-white/[0.07]">
          <p className="text-[11px] text-white/35">
            Exports all clips with in/out points, ratings, and flags.
            {inTimeline > 0 && ' Timeline included as primary sequence.'}
          </p>
          <div className="flex gap-2 flex-shrink-0 ml-4">
            <button onClick={onClose} className="btn-apple px-4 py-2 text-[12px]">
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="btn-apple btn-apple-accent flex items-center gap-1.5 px-4 py-2 text-[12px]"
            >
              {exporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  Export {FORMATS.find(f => f.id === selected)?.name}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
