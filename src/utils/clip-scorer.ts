// ──────────────────────────────────────────────────────────────────────────────
// Clip Quality Scorer — thinks like a human wedding editor
//
// A human editor evaluating two similar clips asks:
//   1. Is it in focus?        → sharpness (35%)
//   2. Is the exposure right? → exposure (20%)
//   3. Is the quality high?   → technical: bitrate + resolution + fps (25%)
//   4. Does it have good audio? → audio presence + sample rate (10%)
//   5. How much content does it have? → duration value (10%)
//
// Final score: 0–100, higher = keep this one
// ──────────────────────────────────────────────────────────────────────────────

import type { MediaClip } from '../types'
import { estimateSharpness, estimateExposure } from './perceptual-hash'

export interface ClipScore {
  clipId: string
  total: number           // 0–100 composite score
  sharpness: number       // 0–100
  exposure: number        // 0–100
  technical: number       // 0–100
  audio: number           // 0–100
  duration: number        // 0–100 (relative within group)
  recommendation: 'keep' | 'review' | 'reject'
  reasons: string[]       // human-readable explanation
}

/**
 * Score a group of clips against each other.
 * Returns scores sorted best-first.
 */
export async function scoreClipGroup(clips: MediaClip[]): Promise<ClipScore[]> {
  if (clips.length === 0) return []

  // Compute async image-based scores in parallel
  const imageScores = await Promise.all(
    clips.map(async (clip) => {
      if (!clip.thumbnail) return { sharpness: 50, exposure: 50 }
      const [sharpness, exposure] = await Promise.all([
        estimateSharpness(clip.thumbnail),
        estimateExposure(clip.thumbnail),
      ])
      return { sharpness, exposure }
    })
  )

  // Technical scores (sync)
  const techScores = clips.map((clip) => scoreTechnical(clip))
  const audioScores = clips.map((clip) => scoreAudio(clip))

  // Duration score: normalize within group (longest gets 100)
  const durations = clips.map((c) => c.info?.duration ?? 0)
  const maxDur = Math.max(...durations, 1)
  const durScores = durations.map((d) => Math.round((d / maxDur) * 100))

  // Composite weighted scores
  const composites = clips.map((_, i) => {
    const s = imageScores[i]
    return (
      s.sharpness  * 0.35 +
      s.exposure   * 0.20 +
      techScores[i]  * 0.25 +
      audioScores[i] * 0.10 +
      durScores[i]   * 0.10
    )
  })

  // Build result objects
  const scores: ClipScore[] = clips.map((clip, i) => {
    const total = Math.round(composites[i])
    return {
      clipId: clip.id,
      total,
      sharpness:  imageScores[i].sharpness,
      exposure:   imageScores[i].exposure,
      technical:  techScores[i],
      audio:      audioScores[i],
      duration:   durScores[i],
      recommendation: 'review',  // filled below
      reasons: buildReasons(clip, imageScores[i].sharpness, imageScores[i].exposure, techScores[i], audioScores[i]),
    }
  })

  // Sort by total descending to determine recommendations
  const sorted = [...scores].sort((a, b) => b.total - a.total)
  const topScore = sorted[0]?.total ?? 0

  sorted.forEach((s, rank) => {
    if (rank === 0) {
      s.recommendation = 'keep'
    } else if (s.total >= topScore * 0.85) {
      s.recommendation = 'review'  // close call — human should decide
    } else {
      s.recommendation = 'reject'
    }
  })

  return sorted
}

// ── Technical score ───────────────────────────────────────────────────────────

function scoreTechnical(clip: MediaClip): number {
  const info = clip.info
  if (!info) return 0

  let score = 0

  // Resolution (up to 40 pts)
  const pixels = info.width * info.height
  if (pixels >= 3840 * 2160) score += 40       // 4K
  else if (pixels >= 2560 * 1440) score += 32  // 2.7K
  else if (pixels >= 1920 * 1080) score += 25  // 1080p
  else if (pixels >= 1280 * 720)  score += 15  // 720p
  else score += 5

  // Bitrate (up to 35 pts) — higher bitrate = less compression artifact
  const mbps = info.bitrate / 1_000_000
  if (mbps >= 100) score += 35       // ProRes / RAW range
  else if (mbps >= 50) score += 30   // high-quality H.264/H.265
  else if (mbps >= 25) score += 22   // good quality
  else if (mbps >= 10) score += 14   // typical phone/mirrorless
  else if (mbps >= 4)  score += 8    // compressed
  else score += 2

  // Frame rate (up to 15 pts)
  if (info.fps >= 120) score += 15      // super slow-mo capable
  else if (info.fps >= 60) score += 12  // slow-mo capable
  else if (info.fps >= 30) score += 8   // standard
  else if (info.fps >= 24) score += 6   // cinematic
  else score += 3

  // Codec quality bonus (up to 10 pts)
  const codec = (info.codec ?? '').toLowerCase()
  if (codec.includes('prores') || codec.includes('raw')) score += 10
  else if (codec.includes('hevc') || codec.includes('h265')) score += 7
  else if (codec.includes('h264') || codec.includes('avc')) score += 5
  else score += 2

  return Math.min(100, score)
}

// ── Audio score ───────────────────────────────────────────────────────────────

function scoreAudio(clip: MediaClip): number {
  const info = clip.info
  if (!info || !info.audioCodec) return 0

  let score = 50  // has audio = baseline

  // Channels
  if (info.audioChannels >= 2) score += 20
  else if (info.audioChannels === 1) score += 10

  // Sample rate
  if (info.audioSampleRate >= 48000) score += 20
  else if (info.audioSampleRate >= 44100) score += 15
  else if (info.audioSampleRate >= 32000) score += 8

  // Audio codec quality
  const aCodec = info.audioCodec.toLowerCase()
  if (aCodec.includes('pcm') || aCodec.includes('lpcm')) score += 10
  else if (aCodec.includes('aac')) score += 7
  else if (aCodec.includes('mp3')) score += 4

  return Math.min(100, score)
}

// ── Human-readable reasons ────────────────────────────────────────────────────

function buildReasons(
  clip: MediaClip,
  sharpness: number,
  exposure: number,
  technical: number,
  audio: number
): string[] {
  const reasons: string[] = []
  const info = clip.info

  if (sharpness >= 75) reasons.push('Sharp and in focus')
  else if (sharpness < 40) reasons.push('May have motion blur or soft focus')

  if (exposure >= 75) reasons.push('Well-exposed')
  else if (exposure < 40) reasons.push('Possibly over or under-exposed')

  if (info) {
    const pixels = info.width * info.height
    if (pixels >= 3840 * 2160) reasons.push('4K resolution')
    else if (pixels >= 1920 * 1080) reasons.push('1080p resolution')

    if (info.fps >= 60) reasons.push(`${info.fps}fps — slow-motion capable`)

    const mbps = info.bitrate / 1_000_000
    if (mbps >= 50) reasons.push(`High bitrate (${mbps.toFixed(0)} Mbps)`)
    else if (mbps < 5) reasons.push(`Low bitrate (${mbps.toFixed(1)} Mbps)`)

    if (info.duration >= 10) reasons.push(`${info.duration.toFixed(1)}s — good length`)
    else if (info.duration < 3) reasons.push('Very short clip')
  }

  if (!info?.audioCodec) reasons.push('No audio track')
  else if (audio >= 70) reasons.push('Good audio quality')

  return reasons
}

// ── Duplicate group detection ─────────────────────────────────────────────────

export interface DuplicateGroup {
  id: string
  clips: MediaClip[]
  similarity: number    // 0–1 max similarity within group
  groupType: 'visual' | 'temporal' | 'both'
  scores?: ClipScore[]
}

/**
 * Detect duplicate/similar clip groups using:
 *   - Perceptual hash visual similarity (primary)
 *   - File creation time proximity (secondary)
 *   - Duration similarity (tertiary)
 *
 * @param clips All clips in project
 * @param hashes Pre-computed pHash strings keyed by clip.id
 * @param hashThreshold Max hamming distance to consider similar (default 12/64)
 * @param timeWindowSeconds Clips within this many seconds of each other by creation time
 */
export function detectDuplicateGroups(
  clips: MediaClip[],
  hashes: Record<string, string>,
  hashThreshold = 12,
  timeWindowSeconds = 120
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = []
  const assigned = new Set<string>()

  for (let i = 0; i < clips.length; i++) {
    if (assigned.has(clips[i].id)) continue

    const group: MediaClip[] = [clips[i]]
    let maxSimilarity = 0
    let groupType: DuplicateGroup['groupType'] = 'visual'
    const matchedTypes = new Set<string>()

    for (let j = i + 1; j < clips.length; j++) {
      if (assigned.has(clips[j].id)) continue

      const a = clips[i]
      const b = clips[j]
      let matchScore = 0

      // ── Visual similarity via pHash ──────────────
      const ha = hashes[a.id]
      const hb = hashes[b.id]
      let visualSim = 0
      if (ha && hb) {
        const dist = hammingDistanceRaw(ha, hb)
        if (dist <= hashThreshold) {
          visualSim = 1 - dist / 64
          matchScore += 2
          matchedTypes.add('visual')
        }
      }

      // ── Temporal proximity ───────────────────────
      const tA = a.info?.createdAt ? Date.parse(a.info.createdAt) / 1000 : a.importedAt / 1000
      const tB = b.info?.createdAt ? Date.parse(b.info.createdAt) / 1000 : b.importedAt / 1000
      if (Math.abs(tA - tB) <= timeWindowSeconds) {
        matchScore += 1
        matchedTypes.add('temporal')
      }

      // ── Duration similarity (within 15%) ─────────
      const durA = a.info?.duration ?? 0
      const durB = b.info?.duration ?? 0
      if (durA > 0 && durB > 0) {
        const durRatio = Math.min(durA, durB) / Math.max(durA, durB)
        if (durRatio >= 0.85) {
          matchScore += 0.5
        }
      }

      // Needs at least visual OR (temporal + duration) to be a duplicate
      const isVisualMatch = matchedTypes.has('visual')
      const isTemporalDurMatch = matchedTypes.has('temporal') && matchScore >= 1.5

      if (isVisualMatch || isTemporalDurMatch) {
        group.push(b)
        assigned.add(b.id)
        if (visualSim > maxSimilarity) maxSimilarity = visualSim

        if (matchedTypes.has('visual') && matchedTypes.has('temporal')) {
          groupType = 'both'
        } else if (matchedTypes.has('temporal')) {
          groupType = 'temporal'
        }
      }
    }

    if (group.length > 1) {
      assigned.add(clips[i].id)
      groups.push({
        id: `dup_${i}_${Date.now()}`,
        clips: group,
        similarity: maxSimilarity,
        groupType,
      })
    }
  }

  return groups
}

function hammingDistanceRaw(h1: string, h2: string): number {
  let d = 0
  for (let i = 0; i < Math.min(h1.length, h2.length); i++) {
    if (h1[i] !== h2[i]) d++
  }
  return d
}
