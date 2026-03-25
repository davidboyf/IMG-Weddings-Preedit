import React, { useState, useEffect, useCallback } from 'react'
import { X, Loader2, CheckCircle2, AlertCircle, Trash2, Eye, EyeOff, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { useProjectStore } from '../stores/useProjectStore'
import { computeHash } from '../utils/perceptual-hash'
import { detectDuplicateGroups, scoreClipGroup, type DuplicateGroup, type ClipScore } from '../utils/clip-scorer'
import { formatDuration, formatFileSize } from '../utils/timecode'
import type { MediaClip } from '../types'

interface Props {
  onClose: () => void
}

type Phase = 'idle' | 'hashing' | 'analyzing' | 'scoring' | 'done'

export default function DuplicateDetector({ onClose }: Props) {
  const { clips, setFlag, removeClips } = useProjectStore()

  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [groups, setGroups] = useState<(DuplicateGroup & { scores: ClipScore[] })[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [threshold, setThreshold] = useState(12)    // Hamming distance 0–64
  const [timeWindow, setTimeWindow] = useState(120) // seconds
  const [marked, setMarked] = useState<Set<string>>(new Set())

  const run = useCallback(async () => {
    setPhase('hashing')
    setProgress(0)
    setGroups([])
    setMarked(new Set())

    // ── Phase 1: compute perceptual hashes ──────────────────────────────────
    const hashes: Record<string, string> = {}
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      if (clip.thumbnail) {
        const hash = await computeHash(clip.thumbnail)
        if (hash) hashes[clip.id] = hash
      }
      setProgress(Math.round(((i + 1) / clips.length) * 40))
    }

    // ── Phase 2: detect duplicate groups ────────────────────────────────────
    setPhase('analyzing')
    const rawGroups = detectDuplicateGroups(clips, hashes, threshold, timeWindow)
    setProgress(60)

    // ── Phase 3: score each group ────────────────────────────────────────────
    setPhase('scoring')
    const scoredGroups: (DuplicateGroup & { scores: ClipScore[] })[] = []
    for (let i = 0; i < rawGroups.length; i++) {
      const g = rawGroups[i]
      const scores = await scoreClipGroup(g.clips)
      scoredGroups.push({ ...g, scores })
      setProgress(60 + Math.round(((i + 1) / rawGroups.length) * 38))
    }

    // Sort: most duplicates first
    scoredGroups.sort((a, b) => b.clips.length - a.clips.length)

    setGroups(scoredGroups)
    setExpandedGroups(new Set(scoredGroups.map((g) => g.id)))
    setPhase('done')
    setProgress(100)

    // Auto-mark recommended rejects
    const autoRejects = new Set<string>()
    for (const g of scoredGroups) {
      for (const s of g.scores) {
        if (s.recommendation === 'reject') autoRejects.add(s.clipId)
      }
    }
    setMarked(autoRejects)
  }, [clips, threshold, timeWindow])

  const totalDuplicates = groups.reduce((n, g) => n + g.clips.length - 1, 0)

  const applyMarked = (action: 'reject' | 'remove') => {
    const ids = Array.from(marked)
    if (action === 'reject') {
      ids.forEach((id) => setFlag(id, 'reject'))
    } else {
      removeClips(ids)
    }
    onClose()
  }

  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleMark = (clipId: string) =>
    setMarked((prev) => {
      const next = new Set(prev)
      next.has(clipId) ? next.delete(clipId) : next.add(clipId)
      return next
    })

  const scoreColor = (score: number) => {
    if (score >= 70) return 'text-[#34d399]'
    if (score >= 45) return 'text-[#fbbf24]'
    return 'text-[#f87171]'
  }

  const recoBadge = (rec: ClipScore['recommendation'], isMarked: boolean) => {
    if (isMarked) return { label: 'Reject', cls: 'bg-[#f87171]/15 text-[#f87171] border-[#f87171]/25' }
    if (rec === 'keep') return { label: 'Keep', cls: 'bg-[#34d399]/15 text-[#34d399] border-[#34d399]/25' }
    if (rec === 'review') return { label: 'Review', cls: 'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/25' }
    return { label: 'Reject', cls: 'bg-[#f87171]/15 text-[#f87171] border-[#f87171]/25' }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-3xl rounded-2xl flex flex-col overflow-hidden"
        style={{
          maxHeight: '88vh',
          background: 'rgba(10,10,20,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.85)',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(228,188,114,0.12)' }}>
              <Sparkles className="w-4 h-4 text-[#e4bc72]" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-white/90">Duplicate Detector</h2>
              <p className="text-[11px] text-white/40">{clips.length} clips · AI-powered visual + temporal analysis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Config + Run */}
        {phase === 'idle' && (
          <div className="p-5 space-y-5 flex-1 overflow-y-auto">
            <div className="rounded-xl p-4 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <p className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Detection Sensitivity</p>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] text-white/60">Visual similarity threshold</span>
                  <span className="text-[11px] font-mono text-[#e4bc72]">{Math.round((1 - threshold / 64) * 100)}%</span>
                </div>
                <input type="range" min={4} max={24} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full" />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-white/25">Strict (only near-identical)</span>
                  <span className="text-[9px] text-white/25">Loose (similar scenes)</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[11px] text-white/60">Time window for temporal grouping</span>
                  <span className="text-[11px] font-mono text-[#e4bc72]">{timeWindow}s</span>
                </div>
                <input type="range" min={30} max={600} step={30} value={timeWindow} onChange={(e) => setTimeWindow(Number(e.target.value))}
                  className="w-full" />
                <div className="flex justify-between mt-0.5">
                  <span className="text-[9px] text-white/25">30s</span>
                  <span className="text-[9px] text-white/25">10 min</span>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(228,188,114,0.04)', border: '1px solid rgba(228,188,114,0.1)' }}>
              <p className="text-[11px] font-semibold text-[#e4bc72]/80">How it thinks like a human editor</p>
              {[
                ['🔍', 'Perceptual hash', 'DCT-based visual fingerprint of every clip thumbnail'],
                ['⏱', 'Temporal clustering', 'Groups clips recorded within your time window'],
                ['🎯', 'Quality scoring', 'Rates sharpness, exposure, bitrate, resolution, audio'],
                ['⭐', 'Smart recommendation', 'Suggests which take to keep in each group'],
              ].map(([icon, title, desc]) => (
                <div key={title as string} className="flex gap-2">
                  <span className="text-[13px] flex-shrink-0">{icon}</span>
                  <div>
                    <span className="text-[11px] font-medium text-white/70">{title}: </span>
                    <span className="text-[11px] text-white/40">{desc}</span>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={run}
              className="w-full btn-apple btn-apple-accent py-3 text-[13px] font-semibold flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" />
              Analyze {clips.length} Clips for Duplicates
            </button>
          </div>
        )}

        {/* Progress */}
        {(phase === 'hashing' || phase === 'analyzing' || phase === 'scoring') && (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8">
            <Loader2 className="w-8 h-8 text-[#e4bc72] animate-spin" />
            <div className="text-center">
              <p className="text-[14px] font-medium text-white/80">
                {phase === 'hashing' && 'Computing perceptual fingerprints…'}
                {phase === 'analyzing' && 'Finding visual & temporal clusters…'}
                {phase === 'scoring' && 'Scoring clip quality like a human editor…'}
              </p>
              <p className="text-[11px] text-white/35 mt-1">{progress}% complete</p>
            </div>
            <div className="w-64 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full bg-[#e4bc72] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Results */}
        {phase === 'done' && (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.06] flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              {groups.length === 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#34d399]" />
                  <span className="text-[12px] text-white/70">No duplicates found — your library looks clean!</span>
                </div>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-[#fbbf24] flex-shrink-0" />
                  <span className="text-[12px] text-white/70">
                    Found <span className="text-white font-semibold">{groups.length} groups</span> with{' '}
                    <span className="text-[#fbbf24] font-semibold">{totalDuplicates} duplicate clips</span>
                  </span>
                  <div className="flex-1" />
                  <span className="text-[11px] text-white/40">{marked.size} marked for rejection</span>
                </>
              )}
            </div>

            {/* Groups list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.id)
                const bestScore = group.scores[0]
                return (
                  <div key={group.id} className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>

                    {/* Group header */}
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
                      onClick={() => toggleGroup(group.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-white/85">
                            {group.clips.length} similar clips
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium"
                            style={{
                              background: group.groupType === 'both' ? 'rgba(228,188,114,0.15)' : 'rgba(255,255,255,0.07)',
                              color: group.groupType === 'both' ? '#e4bc72' : 'rgba(255,255,255,0.5)',
                            }}>
                            {group.groupType === 'both' ? 'Visual + Temporal' : group.groupType === 'visual' ? 'Visual match' : 'Temporal match'}
                          </span>
                          {group.similarity > 0 && (
                            <span className="text-[10px] text-white/30">
                              {Math.round(group.similarity * 100)}% similar
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/35 mt-0.5 truncate">
                          Best: {clips.find(c => c.id === bestScore?.clipId)?.fileName ?? '—'}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-white/30 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />}
                    </button>

                    {/* Clip cards */}
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] divide-y divide-white/[0.04]">
                        {group.scores.map((score) => {
                          const clip = clips.find((c) => c.id === score.clipId)
                          if (!clip) return null
                          const isMarked = marked.has(clip.id)
                          const badge = recoBadge(score.recommendation, isMarked)

                          return (
                            <div key={clip.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${isMarked ? 'bg-[#f87171]/[0.04]' : ''}`}>
                              {/* Thumbnail */}
                              <div className="w-16 h-10 rounded-md overflow-hidden flex-shrink-0 bg-black/40">
                                {clip.thumbnail
                                  ? <img src={clip.thumbnail} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full flex items-center justify-center text-white/10 text-[10px]">No thumb</div>
                                }
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="text-[11px] font-medium text-white/80 truncate">{clip.fileName}</p>
                                  <span className={`px-1.5 py-px rounded text-[9px] font-medium border flex-shrink-0 ${badge.cls}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] text-white/35">{formatDuration(clip.info?.duration ?? 0)}</span>
                                  <span className="text-[10px] text-white/25">·</span>
                                  <span className="text-[10px] text-white/35">{clip.info?.width}×{clip.info?.height}</span>
                                  <span className="text-[10px] text-white/25">·</span>
                                  <span className="text-[10px] text-white/35">{formatFileSize(clip.info?.size ?? 0)}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-1">
                                  {[
                                    ['Sharp', score.sharpness],
                                    ['Exposure', score.exposure],
                                    ['Tech', score.technical],
                                    ['Audio', score.audio],
                                  ].map(([label, val]) => (
                                    <div key={label} className="flex items-center gap-1">
                                      <span className="text-[9px] text-white/25">{label}</span>
                                      <span className={`text-[9px] font-mono font-medium ${scoreColor(val as number)}`}>{val as number}</span>
                                    </div>
                                  ))}
                                  <span className={`text-[10px] font-bold font-mono ml-auto ${scoreColor(score.total)}`}>
                                    {score.total}
                                  </span>
                                </div>
                                {score.reasons.length > 0 && (
                                  <p className="text-[9px] text-white/25 mt-0.5 truncate">
                                    {score.reasons.slice(0, 2).join(' · ')}
                                  </p>
                                )}
                              </div>

                              {/* Toggle mark */}
                              <button
                                onClick={() => toggleMark(clip.id)}
                                title={isMarked ? 'Unmark' : 'Mark for rejection'}
                                className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${
                                  isMarked
                                    ? 'bg-[#f87171]/15 text-[#f87171]'
                                    : 'text-white/20 hover:text-white/50 hover:bg-white/[0.06]'
                                }`}>
                                {isMarked ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Action footer */}
            {groups.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.07] flex-shrink-0">
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    const allRejects = new Set<string>()
                    groups.forEach(g => g.scores.filter(s => s.recommendation === 'reject').forEach(s => allRejects.add(s.clipId)))
                    setMarked(allRejects)
                  }} className="text-[11px] text-white/40 hover:text-white/60 transition-colors">
                    Auto-select
                  </button>
                  <span className="text-white/20">·</span>
                  <button onClick={() => setMarked(new Set())} className="text-[11px] text-white/40 hover:text-white/60 transition-colors">
                    Clear all
                  </button>
                </div>
                <div className="flex gap-2">
                  <button onClick={onClose} className="btn-apple px-4 py-1.5 text-[12px]">Cancel</button>
                  <button
                    onClick={() => applyMarked('reject')}
                    disabled={marked.size === 0}
                    className="btn-apple flex items-center gap-1.5 px-4 py-1.5 text-[12px] disabled:opacity-40"
                    style={{ background: marked.size > 0 ? 'rgba(248,113,113,0.15)' : undefined, color: marked.size > 0 ? '#f87171' : undefined }}>
                    <EyeOff className="w-3.5 h-3.5" />
                    Flag {marked.size} as Reject
                  </button>
                  <button
                    onClick={() => applyMarked('remove')}
                    disabled={marked.size === 0}
                    className="btn-apple btn-apple-accent flex items-center gap-1.5 px-4 py-1.5 text-[12px] disabled:opacity-40">
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete {marked.size} Clips
                  </button>
                </div>
              </div>
            )}
            {groups.length === 0 && (
              <div className="flex justify-end px-5 py-3 border-t border-white/[0.07] flex-shrink-0">
                <button onClick={onClose} className="btn-apple btn-apple-accent px-6 py-1.5 text-[12px]">Done</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
