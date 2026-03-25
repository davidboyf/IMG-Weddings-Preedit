// ──────────────────────────────────────────────
// Core data types for IMG Weddings Preedit
// ──────────────────────────────────────────────

export type ClipRating = 0 | 1 | 2 | 3 | 4 | 5
export type ClipFlag = 'none' | 'pick' | 'reject' | 'review'
export type ExportFormat = 'fcpxml' | 'xmeml' | 'edl' | 'csv'

export interface VideoInfo {
  duration: number
  size: number
  bitrate: number
  codec: string
  width: number
  height: number
  fps: number
  audioCodec: string | null
  audioChannels: number
  audioSampleRate: number
  createdAt: string | null
}

export interface Marker {
  id: string
  timeSeconds: number
  label: string
  color: string
}

export interface MediaClip {
  id: string
  filePath: string
  fileName: string
  thumbnail: string | null
  info: VideoInfo | null
  inPoint: number       // seconds — null means start
  outPoint: number      // seconds — null means end
  inPointSet: boolean
  outPointSet: boolean
  rating: ClipRating
  flag: ClipFlag
  notes: string
  markers: Marker[]
  // Audio overrides
  volume: number        // 0..2, 1 = 100%
  audioBalance: number  // -1..1, 0 = center
  // Metadata
  importedAt: number    // Date.now()
  waveformPeaks: number[] | null
  group: string         // e.g. "Ceremony", "Reception"
  reelName: string      // camera/reel label
}

export interface TimelineClip {
  id: string
  sourceClipId: string
  timelineStart: number   // seconds in the timeline
  duration: number        // out - in
  inPoint: number
  outPoint: number
  volume: number
  audioBalance: number
  trackIndex: number
}

export interface ProjectSettings {
  name: string
  eventDate: string       // ISO date
  couple: string
  frameRate: number
  resolution: { width: number; height: number }
  outputDir: string
}

export interface Project {
  version: string
  settings: ProjectSettings
  clips: MediaClip[]
  timeline: TimelineClip[]
  savedAt: number
}

// ──────────────────────────────────────────────
// UI State
// ──────────────────────────────────────────────
export type Panel = 'browser' | 'inspector' | 'audio' | 'export'
export type ViewMode = 'filmstrip' | 'list' | 'icon'
export type SortField = 'name' | 'duration' | 'rating' | 'flag' | 'date' | 'group'
export type FilterMode = 'all' | 'picks' | 'rejects' | 'review' | 'unrated'
