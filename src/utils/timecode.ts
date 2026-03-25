/**
 * Timecode utilities for IMG Weddings Preedit
 */

/**
 * Format seconds to HH:MM:SS:FF timecode
 */
export function formatTimecode(seconds: number, fps: number): string {
  const totalFrames = Math.round(seconds * fps)
  const frames = totalFrames % Math.round(fps)
  const totalSecs = Math.floor(totalFrames / Math.round(fps))
  const secs = totalSecs % 60
  const mins = Math.floor(totalSecs / 60) % 60
  const hours = Math.floor(totalSecs / 3600)

  return [
    String(hours).padStart(2, '0'),
    String(mins).padStart(2, '0'),
    String(secs).padStart(2, '0'),
    String(frames).padStart(2, '0'),
  ].join(':')
}

/**
 * Format seconds to human-readable MM:SS.mmm
 */
export function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 100)
  return `${m}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
}

/**
 * Format seconds as short display (e.g. "1:23")
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Convert frames to seconds
 */
export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps
}

/**
 * Convert seconds to frames (rounded)
 */
export function secondsToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps)
}

/**
 * Parse timecode string HH:MM:SS:FF → seconds
 */
export function parseTimecode(tc: string, fps: number): number {
  const parts = tc.split(':').map(Number)
  if (parts.length !== 4) return 0
  const [h, m, s, f] = parts
  return h * 3600 + m * 60 + s + f / fps
}

/**
 * Format file size in human-readable form
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Format bitrate
 */
export function formatBitrate(bps: number): string {
  if (bps < 1000) return `${bps} bps`
  if (bps < 1_000_000) return `${(bps / 1000).toFixed(0)} kbps`
  return `${(bps / 1_000_000).toFixed(1)} Mbps`
}
