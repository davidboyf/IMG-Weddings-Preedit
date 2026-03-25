import React, { useEffect, useState } from 'react'
import { FolderOpen, Zap, CheckCircle, AlertCircle, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { formatFileSize } from '../utils/timecode'

export default function ProxyPanel() {
  const {
    clips, settings, updateSettings,
    setProxyStatus, setUseProxy,
    proxyQueue,
  } = useProjectStore()

  const [proxyDir, setProxyDir] = useState(settings.outputDir || '')
  const [proxyProgress, setProxyProgress] = useState<Record<string, number>>({})

  // Listen for proxy progress from main process
  useEffect(() => {
    if (!window.electronAPI?.onProxyProgress) return
    return window.electronAPI.onProxyProgress(({ clipId, elapsed }) => {
      setProxyProgress((prev) => ({ ...prev, [clipId]: elapsed }))
    })
  }, [])

  const handleBrowseDir = async () => {
    const dir = await window.electronAPI.openDirectory({ defaultPath: proxyDir || undefined })
    if (dir) {
      setProxyDir(dir)
      updateSettings({ outputDir: dir })
    }
  }

  const handleCreateProxy = async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId)
    if (!clip || !proxyDir) return

    setProxyStatus(clipId, 'creating')
    const result = await window.electronAPI.createProxy(clipId, clip.filePath, proxyDir)
    if (result.success && result.proxyPath) {
      setProxyStatus(clipId, 'ready', result.proxyPath)
    } else {
      setProxyStatus(clipId, 'error')
    }
    setProxyProgress((prev) => { const n = { ...prev }; delete n[clipId]; return n })
  }

  const handleCreateAllProxies = async () => {
    if (!proxyDir) return
    for (const clip of clips.filter((c) => c.proxyStatus === 'none' || c.proxyStatus === 'error')) {
      await handleCreateProxy(clip.id)
    }
  }

  const proxied = clips.filter((c) => c.proxyStatus === 'ready').length
  const pending = clips.filter((c) => c.proxyStatus === 'none').length
  const creating = clips.filter((c) => c.proxyStatus === 'creating').length
  const errors = clips.filter((c) => c.proxyStatus === 'error').length

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      {/* Proxy directory */}
      <div className="rounded-xl p-3 space-y-2"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="text-[11px] font-medium text-white/50">Proxy Output Folder</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={proxyDir}
            onChange={(e) => setProxyDir(e.target.value)}
            placeholder="/path/to/proxy/folder"
            className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-white/70 outline-none focus:border-[#e4bc72]/40 min-w-0"
          />
          <button onClick={handleBrowseDir} className="btn-apple px-2.5 flex-shrink-0">
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>
        {!proxyDir && (
          <p className="text-[10px] text-[#fbbf24]/70">Set a folder before creating proxies.</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Ready', proxied, '#34d399'],
          ['Pending', pending, 'rgba(255,255,255,0.4)'],
          ['Creating', creating, '#e4bc72'],
          ['Errors', errors, '#f87171'],
        ].map(([label, count, color]) => (
          <div key={label as string} className="rounded-lg p-2.5"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-white/35">{label}</p>
            <p className="text-[15px] font-semibold" style={{ color: color as string }}>{count}</p>
          </div>
        ))}
      </div>

      {/* Create all */}
      {pending > 0 && proxyDir && (
        <button
          onClick={handleCreateAllProxies}
          disabled={creating > 0}
          className="btn-apple flex items-center justify-center gap-2 py-2.5"
        >
          {creating > 0 ? (
            <><RefreshCw className="w-4 h-4 animate-spin" /> Creating {creating} proxies…</>
          ) : (
            <><Zap className="w-4 h-4" /> Create {pending} Proxy{pending !== 1 ? 'ies' : ''}</>
          )}
        </button>
      )}

      {/* Per-clip list */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-medium text-white/35 uppercase tracking-wider">All Clips</p>
        {clips.map((clip) => {
          const elapsed = proxyProgress[clip.id]
          const dur = clip.info?.duration ?? 0
          const pct = dur > 0 && elapsed ? Math.min(99, (elapsed / dur) * 100) : 0

          return (
            <div key={clip.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg group"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              {/* Status icon */}
              <div className="flex-shrink-0">
                {clip.proxyStatus === 'ready'    && <CheckCircle className="w-3.5 h-3.5 text-[#34d399]" />}
                {clip.proxyStatus === 'creating' && <RefreshCw className="w-3.5 h-3.5 text-[#e4bc72] animate-spin" />}
                {clip.proxyStatus === 'error'    && <AlertCircle className="w-3.5 h-3.5 text-[#f87171]" />}
                {clip.proxyStatus === 'none'     && <div className="w-3.5 h-3.5 rounded-full border border-white/15" />}
              </div>

              {/* Name + progress */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/70 truncate">{clip.fileName}</p>
                {clip.proxyStatus === 'creating' && elapsed && (
                  <div className="mt-0.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full bg-[#e4bc72] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
                {clip.proxyStatus === 'ready' && clip.proxyPath && (
                  <p className="text-[9px] text-white/25 truncate font-mono">{clip.proxyPath.split('/').pop()}</p>
                )}
              </div>

              {/* Use proxy toggle */}
              {clip.proxyStatus === 'ready' && (
                <button
                  onClick={() => setUseProxy(clip.id, !clip.useProxy)}
                  className="flex-shrink-0"
                  title={clip.useProxy ? 'Using proxy — click to use original' : 'Using original — click to use proxy'}
                >
                  {clip.useProxy
                    ? <ToggleRight className="w-5 h-5 text-[#e4bc72]" />
                    : <ToggleLeft className="w-5 h-5 text-white/30" />
                  }
                </button>
              )}

              {/* Create / retry */}
              {(clip.proxyStatus === 'none' || clip.proxyStatus === 'error') && proxyDir && (
                <button
                  onClick={() => handleCreateProxy(clip.id)}
                  className="text-[10px] text-white/35 hover:text-white/70 transition-colors flex-shrink-0"
                >
                  {clip.proxyStatus === 'error' ? 'Retry' : 'Create'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
