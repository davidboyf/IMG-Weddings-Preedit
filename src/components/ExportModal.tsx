import React, { useState } from 'react'
import { Download, X, Film, FileText, Table2, CheckCircle, Scissors, FolderOpen } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatDuration } from '../utils/timecode'
import type { ExportFormat } from '../types'

interface Props {
  onExport: (format: ExportFormat) => void
  onClose: () => void
}

const XML_FORMATS: {
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
    compat: ['Final Cut Pro X', 'DaVinci Resolve 18+', 'Premiere (plugin)'],
    icon: <Film className="w-4 h-4" />,
    color: '#34d399',
  },
  {
    id: 'xmeml',
    name: 'Premiere Pro XML',
    subtitle: 'FCP7 / XMEML — universal NLE format',
    compat: ['Adobe Premiere Pro', 'DaVinci Resolve', 'Avid Media Composer'],
    icon: <Film className="w-4 h-4" />,
    color: '#60a5fa',
  },
  {
    id: 'aaf',
    name: 'AAF-Compatible XML',
    subtitle: 'Full audio routing — Avid / Premiere',
    compat: ['Adobe Premiere Pro', 'Avid Media Composer', 'Pro Tools (via Premiere)'],
    icon: <Film className="w-4 h-4" />,
    color: '#f472b6',
  },
  {
    id: 'davinci',
    name: 'DaVinci Resolve XML',
    subtitle: 'Resolve-optimised with reel & grade metadata',
    compat: ['DaVinci Resolve 17+', 'Fusion', 'Color grading suites'],
    icon: <Film className="w-4 h-4" />,
    color: '#a78bfa',
  },
  {
    id: 'edl',
    name: 'EDL (CMX 3600)',
    subtitle: 'Edit Decision List — works everywhere',
    compat: ['All NLEs', 'Color suites', 'Archive'],
    icon: <FileText className="w-4 h-4" />,
    color: '#94a3b8',
  },
  {
    id: 'csv',
    name: 'CSV Log',
    subtitle: 'Spreadsheet log with all clip metadata',
    compat: ['Excel', 'Google Sheets', 'Numbers', 'Billing'],
    icon: <Table2 className="w-4 h-4" />,
    color: '#e4bc72',
  },
]

export default function ExportModal({ onExport, onClose }: Props) {
  const { clips, timelineClips, settings, selectedClipIds } = useProjectStore()
  const [selected, setSelected] = useState<ExportFormat>('fcpxml')
  const [exporting, setExporting] = useState(false)

  // Per-clip export state
  const [clipExportDir, setClipExportDir] = useState(settings.outputDir || '')
  const [exportingClips, setExportingClips] = useState(false)
  const [clipExportProgress, setClipExportProgress] = useState({ done: 0, total: 0 })
  const [clipExportLog, setClipExportLog] = useState<{ name: string; ok: boolean }[]>([])
  const [activeTab, setActiveTab] = useState<'xml' | 'clips'>('xml')

  const picks = clips.filter((c) => c.flag === 'pick').length
  const withInOut = clips.filter((c) => c.inPointSet || c.outPointSet).length
  const inTimeline = timelineClips.length
  const totalDuration = timelineClips.reduce((s, tc) => s + tc.duration, 0)

  const handleExport = async () => {
    setExporting(true)
    await onExport(selected)
    setExporting(false)
  }

  const handleBrowseClipDir = async () => {
    const dir = await window.electronAPI.openDirectory()
    if (dir) setClipExportDir(dir)
  }

  const handleExportClips = async () => {
    if (!clipExportDir) return
    const toExport = selectedClipIds.length > 0
      ? clips.filter((c) => selectedClipIds.includes(c.id))
      : clips.filter((c) => c.flag === 'pick' || c.inPointSet || c.outPointSet)

    if (!toExport.length) return

    setExportingClips(true)
    setClipExportProgress({ done: 0, total: toExport.length })
    setClipExportLog([])

    for (let i = 0; i < toExport.length; i++) {
      const clip = toExport[i]
      const inPt  = clip.inPointSet  ? clip.inPoint  : 0
      const outPt = clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)
      const baseName = clip.fileName.replace(/\.[^.]+$/, '')
      const ext = clip.fileName.slice(clip.fileName.lastIndexOf('.'))
      const outName = `${baseName}_cut${ext}`
      const outPath = `${clipExportDir}/${outName}`

      const result = await window.electronAPI.exportClip(clip.filePath, outPath, inPt, outPt)
      setClipExportLog((prev) => [...prev, { name: outName, ok: result.success }])
      setClipExportProgress({ done: i + 1, total: toExport.length })
    }

    setExportingClips(false)
    await window.electronAPI.showInFinder(clipExportDir)
  }

  const clipsToExport = selectedClipIds.length > 0
    ? clips.filter((c) => selectedClipIds.includes(c.id))
    : clips.filter((c) => c.flag === 'pick' || c.inPointSet || c.outPointSet)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-xl rounded-2xl overflow-hidden animate-scale-in flex flex-col"
        style={{
          maxHeight: '85vh',
          background: 'rgba(13,13,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-white/90">Export</h2>
            <p className="text-[12px] text-white/40 mt-0.5">{settings.name}{settings.couple ? ` — ${settings.couple}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.06] flex-shrink-0">
          {[['xml', 'XML / EDL'], ['clips', 'Export Clips']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-2.5 text-[12px] font-medium transition-colors ${
                activeTab === tab ? 'text-white/90 border-b border-[#e4bc72]' : 'text-white/40 hover:text-white/60'
              }`}>{label}</button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-1.5 px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
          {[
            ['Clips', clips.length],
            ['Picks', picks],
            ['I/O Set', withInOut],
            ['Timeline', inTimeline],
            ['Dur', formatDuration(totalDuration)],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg p-2 text-center"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-[9px] text-white/30">{label}</p>
              <p className="text-[12px] font-semibold text-white/75">{value}</p>
            </div>
          ))}
        </div>

        {/* Tab: XML */}
        {activeTab === 'xml' && (
          <div className="overflow-y-auto flex-1">
            <div className="p-4 space-y-2">
              {XML_FORMATS.map((fmt) => (
                <button key={fmt.id} onClick={() => setSelected(fmt.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all`}
                  style={{
                    background: selected === fmt.id ? `${fmt.color}10` : 'rgba(255,255,255,0.03)',
                    border: selected === fmt.id ? `1px solid ${fmt.color}30` : '1px solid rgba(255,255,255,0.06)',
                  }}>
                  <div className="mt-0.5 flex-shrink-0" style={{ color: fmt.color }}>{fmt.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[12px] font-semibold text-white/85">{fmt.name}</p>
                      {selected === fmt.id && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: fmt.color }} />}
                    </div>
                    <p className="text-[10px] text-white/40 mt-0.5">{fmt.subtitle}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {fmt.compat.map((c) => (
                        <span key={c} className="px-1.5 py-0 rounded text-[9px] text-white/35"
                          style={{ background: 'rgba(255,255,255,0.05)' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.07] flex-shrink-0">
              <p className="text-[10px] text-white/30">
                Exports all clips with I/O points, ratings, and flags.
                {inTimeline > 0 && ' Timeline included as primary sequence.'}
              </p>
              <div className="flex gap-2 ml-4 flex-shrink-0">
                <button onClick={onClose} className="btn-apple px-4 py-1.5 text-[12px]">Cancel</button>
                <button onClick={handleExport} disabled={exporting}
                  className="btn-apple btn-apple-accent flex items-center gap-1.5 px-4 py-1.5 text-[12px]">
                  {exporting ? (
                    <><div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />Exporting…</>
                  ) : (
                    <><Download className="w-3.5 h-3.5" />Export {XML_FORMATS.find(f => f.id === selected)?.name}</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Clip Export */}
        {activeTab === 'clips' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
              {/* Output dir */}
              <div>
                <p className="text-[11px] text-white/40 mb-1.5">Output Folder</p>
                <div className="flex gap-2">
                  <input type="text" value={clipExportDir} onChange={(e) => setClipExportDir(e.target.value)}
                    placeholder="/path/to/output"
                    className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-white/70 outline-none focus:border-[#e4bc72]/40 min-w-0" />
                  <button onClick={handleBrowseClipDir} className="btn-apple px-3 flex-shrink-0">
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* What will be exported */}
              <div className="rounded-xl p-3"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[11px] font-medium text-white/50 mb-2">
                  {selectedClipIds.length > 0 ? `${selectedClipIds.length} selected clips` : `${clipsToExport.length} clips (picks + I/O)`}
                </p>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {clipsToExport.slice(0, 20).map((clip) => {
                    const inPt  = clip.inPointSet  ? clip.inPoint  : 0
                    const outPt = clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)
                    return (
                      <div key={clip.id} className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-white/55 truncate flex-1">{clip.fileName}</p>
                        <p className="text-[9px] font-mono text-white/30 flex-shrink-0">{formatDuration(outPt - inPt)}</p>
                      </div>
                    )
                  })}
                  {clipsToExport.length > 20 && (
                    <p className="text-[10px] text-white/30">+{clipsToExport.length - 20} more…</p>
                  )}
                </div>
              </div>

              {/* Progress */}
              {(exportingClips || clipExportLog.length > 0) && (
                <div className="rounded-xl p-3 space-y-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  {exportingClips && (
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-white/50">Exporting…</span>
                        <span className="text-white/40">{clipExportProgress.done}/{clipExportProgress.total}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full bg-[#e4bc72] transition-all"
                          style={{ width: `${(clipExportProgress.done / clipExportProgress.total) * 100}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {clipExportLog.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={entry.ok ? 'text-[#34d399]' : 'text-[#f87171]'}>{entry.ok ? '✓' : '✗'}</span>
                        <span className="text-[10px] text-white/50 truncate">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-white/25 leading-relaxed">
                Uses FFmpeg stream-copy — fast, lossless trimming. Output files keep the original codec.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.07] flex-shrink-0">
              <button onClick={onClose} className="btn-apple px-4 py-1.5 text-[12px]">Close</button>
              <button
                onClick={handleExportClips}
                disabled={exportingClips || !clipExportDir || clipsToExport.length === 0}
                className="btn-apple btn-apple-accent flex items-center gap-1.5 px-4 py-1.5 text-[12px] disabled:opacity-50">
                {exportingClips ? (
                  <><div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />Exporting…</>
                ) : (
                  <><Scissors className="w-3.5 h-3.5" />Export {clipsToExport.length} Clip{clipsToExport.length !== 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
