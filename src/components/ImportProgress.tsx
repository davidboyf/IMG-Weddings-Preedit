import React from 'react'
import { useProjectStore } from '../stores/useProjectStore'

export default function ImportProgress() {
  const { importTotal, importProgress } = useProjectStore()
  const pct = importTotal > 0 ? (importProgress / importTotal) * 100 : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative rounded-2xl p-6 w-72 animate-scale-in"
        style={{
          background: 'rgba(13,13,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        }}
      >
        <p className="text-[13px] font-medium text-white/80 mb-1">Importing footage…</p>
        <p className="text-[11px] text-white/40 mb-4">
          {importProgress} of {importTotal} clip{importTotal !== 1 ? 's' : ''}
        </p>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #e4bc72, #c9a050)',
            }}
          />
        </div>

        <p className="text-[11px] text-white/30 mt-2 text-right">{Math.round(pct)}%</p>
      </div>
    </div>
  )
}
