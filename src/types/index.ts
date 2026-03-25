// ──────────────────────────────────────────────
// Core data types for IMG Weddings Preedit
// ──────────────────────────────────────────────

export type ClipRating = 0 | 1 | 2 | 3 | 4 | 5
export type ClipFlag = 'none' | 'pick' | 'reject' | 'review'
export type ColorLabel = 'none' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple'
export type ExportFormat = 'fcpxml' | 'xmeml' | 'edl' | 'csv' | 'aaf' | 'davinci' | 'clip-export'
export type ProxyStatus = 'none' | 'creating' | 'ready' | 'error'
export type StabilizationStatus = 'none' | 'analyzing' | 'stabilizing' | 'done' | 'error'
export type StabilizationMode = 'cinematic' | 'walk' | 'locked' | 'action'

export const COLOR_LABEL_HEX: Record<ColorLabel, string> = {
  none:   'transparent',
  red:    '#f87171',
  orange: '#fb923c',
  yellow: '#fbbf24',
  green:  '#34d399',
  teal:   '#2dd4bf',
  blue:   '#60a5fa',
  purple: '#a78bfa',
}

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

export interface SubClip {
  id: string
  name: string
  inPoint: number
  outPoint: number
  flag: ClipFlag
  notes: string
  addedAt: number
}

export interface MediaClip {
  id: string
  filePath: string
  fileName: string
  thumbnail: string | null
  info: VideoInfo | null
  inPoint: number
  outPoint: number
  inPointSet: boolean
  outPointSet: boolean
  rating: ClipRating
  flag: ClipFlag
  colorLabel: ColorLabel
  notes: string
  markers: Marker[]
  subClips: SubClip[]
  // Audio
  volume: number
  audioBalance: number
  // Proxy
  proxyPath: string | null
  proxyStatus: ProxyStatus
  useProxy: boolean
  // Stabilization
  stabilizationStatus: StabilizationStatus
  stabilizedPath: string | null
  useStabilized: boolean
  // Metadata
  importedAt: number
  waveformPeaks: number[] | null
  group: string
  reelName: string
}

// ── Color Correction ──────────────────────────
export interface ColorCorrection {
  brightness: number  // -0.5 to 0.5, default 0
  contrast: number    // 0.5 to 2.0, default 1.0
  saturation: number  // 0 to 2.0, default 1.0
}

export const DEFAULT_COLOR: ColorCorrection = { brightness: 0, contrast: 1, saturation: 1 }

// ── Transitions ──────────────────────────────
export type TransitionType = 'none' | 'fade' | 'dissolve' | 'wipeleft' | 'wiperight' | 'slideleft'

// ── Music Track ───────────────────────────────
export interface MusicTrack {
  id: string
  filePath: string
  fileName: string
  startAt: number      // seconds from timeline start
  volume: number       // 0.0 to 2.0
  fadeIn: number       // seconds
  fadeOut: number      // seconds
  duration: number     // audio file duration in seconds
}

export interface TimelineClip {
  id: string
  sourceClipId: string
  timelineStart: number
  duration: number
  inPoint: number
  outPoint: number
  volume: number
  audioBalance: number
  trackIndex: number
  // New editing fields
  speed: number   // 0.25 to 4.0, default 1.0
  color: ColorCorrection
  transitionIn: { type: TransitionType; duration: number }
  transitionOut: { type: TransitionType; duration: number }
}

export interface ProjectSettings {
  name: string
  eventDate: string
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

export interface RecentProject {
  path: string
  name: string
  couple: string
  savedAt: number
  clipCount: number
}

// ── UI State ──────────────────────────────────
export type Panel = 'browser' | 'inspector' | 'audio' | 'export'
export type ViewMode = 'filmstrip' | 'list' | 'icon'
export type SortField = 'name' | 'duration' | 'rating' | 'flag' | 'date' | 'group'
export type FilterMode = 'all' | 'picks' | 'rejects' | 'review' | 'unrated'
