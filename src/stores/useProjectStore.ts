import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  MediaClip, TimelineClip, ProjectSettings, ViewMode,
  SortField, FilterMode, ClipRating, ClipFlag, Marker
} from '../types'

// ──────────────────────────────────────────────
// State shape
// ──────────────────────────────────────────────
interface ProjectState {
  // Project metadata
  settings: ProjectSettings
  projectPath: string | null
  isDirty: boolean

  // Media library
  clips: MediaClip[]
  selectedClipId: string | null

  // Timeline
  timelineClips: TimelineClip[]
  timelineCursorSeconds: number

  // Player state
  currentTime: number
  isPlaying: boolean
  playbackRate: number
  loopInOut: boolean
  volume: number            // master volume
  audioBalance: number      // master balance

  // Browser UI
  viewMode: ViewMode
  sortField: SortField
  sortAscending: boolean
  filterMode: FilterMode
  filterGroup: string | null
  searchQuery: string

  // Right panel
  activePanel: 'inspector' | 'audio' | 'export'
  showTimeline: boolean
  timelineHeight: number

  // Import progress
  importing: boolean
  importTotal: number
  importProgress: number

  // ──────────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────────

  // Clips
  addClips: (clips: MediaClip[]) => void
  removeClip: (id: string) => void
  updateClip: (id: string, patch: Partial<MediaClip>) => void
  selectClip: (id: string | null) => void

  // In/out
  setInPoint: (clipId: string, seconds: number) => void
  setOutPoint: (clipId: string, seconds: number) => void
  clearInPoint: (clipId: string) => void
  clearOutPoint: (clipId: string) => void

  // Rating / flag
  setRating: (clipId: string, rating: ClipRating) => void
  setFlag: (clipId: string, flag: ClipFlag) => void

  // Markers
  addMarker: (clipId: string, marker: Marker) => void
  removeMarker: (clipId: string, markerId: string) => void

  // Timeline
  addToTimeline: (clipId: string) => void
  removeFromTimeline: (timelineClipId: string) => void
  reorderTimeline: (from: number, to: number) => void
  setTimelineCursor: (seconds: number) => void
  clearTimeline: () => void

  // Player
  setCurrentTime: (t: number) => void
  setIsPlaying: (v: boolean) => void
  setPlaybackRate: (r: number) => void
  setLoopInOut: (v: boolean) => void
  setVolume: (v: number) => void
  setAudioBalance: (v: number) => void

  // Browser
  setViewMode: (m: ViewMode) => void
  setSortField: (f: SortField, ascending?: boolean) => void
  setFilterMode: (m: FilterMode) => void
  setFilterGroup: (g: string | null) => void
  setSearchQuery: (q: string) => void

  // UI layout
  setActivePanel: (p: 'inspector' | 'audio' | 'export') => void
  setShowTimeline: (v: boolean) => void
  setTimelineHeight: (h: number) => void

  // Import
  setImporting: (v: boolean, total?: number) => void
  setImportProgress: (n: number) => void

  // Project persistence
  updateSettings: (patch: Partial<ProjectSettings>) => void
  markDirty: () => void
  markSaved: (path: string) => void
  loadProject: (state: Partial<ProjectState>) => void

  // Computed helpers
  getSelectedClip: () => MediaClip | null
  getFilteredClips: () => MediaClip[]
  getGroups: () => string[]
}

// ──────────────────────────────────────────────
// Store implementation
// ──────────────────────────────────────────────
export const useProjectStore = create<ProjectState>()(
  subscribeWithSelector((set, get) => ({
    settings: {
      name: 'New Project',
      eventDate: '',
      couple: '',
      frameRate: 24,
      resolution: { width: 1920, height: 1080 },
      outputDir: '',
    },
    projectPath: null,
    isDirty: false,

    clips: [],
    selectedClipId: null,

    timelineClips: [],
    timelineCursorSeconds: 0,

    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
    loopInOut: false,
    volume: 1,
    audioBalance: 0,

    viewMode: 'filmstrip',
    sortField: 'name',
    sortAscending: true,
    filterMode: 'all',
    filterGroup: null,
    searchQuery: '',

    activePanel: 'inspector',
    showTimeline: true,
    timelineHeight: 220,

    importing: false,
    importTotal: 0,
    importProgress: 0,

    // ── Clips ──────────────────────────────────
    addClips: (newClips) =>
      set((s) => ({
        clips: [...s.clips, ...newClips.filter((c) => !s.clips.find((x) => x.filePath === c.filePath))],
        isDirty: true,
      })),

    removeClip: (id) =>
      set((s) => ({
        clips: s.clips.filter((c) => c.id !== id),
        selectedClipId: s.selectedClipId === id ? null : s.selectedClipId,
        timelineClips: s.timelineClips.filter((tc) => tc.sourceClipId !== id),
        isDirty: true,
      })),

    updateClip: (id, patch) =>
      set((s) => ({
        clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        isDirty: true,
      })),

    selectClip: (id) => set({ selectedClipId: id, currentTime: 0, isPlaying: false }),

    // ── In/Out ─────────────────────────────────
    setInPoint: (clipId, seconds) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, inPoint: seconds, inPointSet: true } : c
        ),
        isDirty: true,
      })),

    setOutPoint: (clipId, seconds) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, outPoint: seconds, outPointSet: true } : c
        ),
        isDirty: true,
      })),

    clearInPoint: (clipId) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, inPoint: 0, inPointSet: false } : c
        ),
        isDirty: true,
      })),

    clearOutPoint: (clipId) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, outPoint: c.info?.duration ?? 0, outPointSet: false } : c
        ),
        isDirty: true,
      })),

    // ── Rating / Flag ──────────────────────────
    setRating: (clipId, rating) =>
      set((s) => ({
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, rating } : c)),
        isDirty: true,
      })),

    setFlag: (clipId, flag) =>
      set((s) => ({
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, flag } : c)),
        isDirty: true,
      })),

    // ── Markers ────────────────────────────────
    addMarker: (clipId, marker) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, markers: [...c.markers, marker] } : c
        ),
        isDirty: true,
      })),

    removeMarker: (clipId, markerId) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, markers: c.markers.filter((m) => m.id !== markerId) } : c
        ),
        isDirty: true,
      })),

    // ── Timeline ───────────────────────────────
    addToTimeline: (clipId) => {
      const clip = get().clips.find((c) => c.id === clipId)
      if (!clip || !clip.info) return
      const inPt = clip.inPointSet ? clip.inPoint : 0
      const outPt = clip.outPointSet ? clip.outPoint : clip.info.duration
      const duration = outPt - inPt

      const existing = get().timelineClips
      const totalDuration = existing.reduce((s, tc) => s + tc.duration, 0)

      const tc: TimelineClip = {
        id: `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        sourceClipId: clipId,
        timelineStart: totalDuration,
        duration,
        inPoint: inPt,
        outPoint: outPt,
        volume: clip.volume,
        audioBalance: clip.audioBalance,
        trackIndex: 0,
      }
      set((s) => ({ timelineClips: [...s.timelineClips, tc], isDirty: true }))
    },

    removeFromTimeline: (tcId) =>
      set((s) => ({
        timelineClips: recalcPositions(s.timelineClips.filter((tc) => tc.id !== tcId)),
        isDirty: true,
      })),

    reorderTimeline: (from, to) =>
      set((s) => {
        const arr = [...s.timelineClips]
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        return { timelineClips: recalcPositions(arr), isDirty: true }
      }),

    setTimelineCursor: (seconds) => set({ timelineCursorSeconds: seconds }),
    clearTimeline: () => set({ timelineClips: [], isDirty: true }),

    // ── Player ─────────────────────────────────
    setCurrentTime: (t) => set({ currentTime: t }),
    setIsPlaying: (v) => set({ isPlaying: v }),
    setPlaybackRate: (r) => set({ playbackRate: r }),
    setLoopInOut: (v) => set({ loopInOut: v }),
    setVolume: (v) => set({ volume: v }),
    setAudioBalance: (v) => set({ audioBalance: v }),

    // ── Browser ────────────────────────────────
    setViewMode: (m) => set({ viewMode: m }),
    setSortField: (f, asc) =>
      set((s) => ({
        sortField: f,
        sortAscending: asc !== undefined ? asc : s.sortField === f ? !s.sortAscending : true,
      })),
    setFilterMode: (m) => set({ filterMode: m }),
    setFilterGroup: (g) => set({ filterGroup: g }),
    setSearchQuery: (q) => set({ searchQuery: q }),

    // ── UI ─────────────────────────────────────
    setActivePanel: (p) => set({ activePanel: p }),
    setShowTimeline: (v) => set({ showTimeline: v }),
    setTimelineHeight: (h) => set({ timelineHeight: h }),

    // ── Import ─────────────────────────────────
    setImporting: (v, total = 0) => set({ importing: v, importTotal: total, importProgress: 0 }),
    setImportProgress: (n) => set({ importProgress: n }),

    // ── Persistence ────────────────────────────
    updateSettings: (patch) =>
      set((s) => ({ settings: { ...s.settings, ...patch }, isDirty: true })),
    markDirty: () => set({ isDirty: true }),
    markSaved: (path) => set({ projectPath: path, isDirty: false }),
    loadProject: (state) => set({ ...state, isDirty: false }),

    // ── Computed ───────────────────────────────
    getSelectedClip: () => {
      const { clips, selectedClipId } = get()
      return clips.find((c) => c.id === selectedClipId) ?? null
    },

    getFilteredClips: () => {
      const { clips, filterMode, filterGroup, searchQuery, sortField, sortAscending } = get()
      let result = [...clips]

      // Filter by mode
      switch (filterMode) {
        case 'picks':   result = result.filter((c) => c.flag === 'pick'); break
        case 'rejects': result = result.filter((c) => c.flag === 'reject'); break
        case 'review':  result = result.filter((c) => c.flag === 'review'); break
        case 'unrated': result = result.filter((c) => c.rating === 0); break
      }

      // Filter by group
      if (filterGroup) result = result.filter((c) => c.group === filterGroup)

      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        result = result.filter((c) =>
          c.fileName.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q) ||
          c.reelName.toLowerCase().includes(q)
        )
      }

      // Sort
      result.sort((a, b) => {
        let cmp = 0
        switch (sortField) {
          case 'name':     cmp = a.fileName.localeCompare(b.fileName); break
          case 'duration': cmp = (a.info?.duration ?? 0) - (b.info?.duration ?? 0); break
          case 'rating':   cmp = a.rating - b.rating; break
          case 'date':     cmp = a.importedAt - b.importedAt; break
          case 'group':    cmp = a.group.localeCompare(b.group); break
        }
        return sortAscending ? cmp : -cmp
      })

      return result
    },

    getGroups: () => {
      const groups = new Set(get().clips.map((c) => c.group).filter(Boolean))
      return Array.from(groups).sort()
    },
  }))
)

// Recalculate sequential timeline positions
function recalcPositions(clips: TimelineClip[]): TimelineClip[] {
  let pos = 0
  return clips.map((tc) => {
    const updated = { ...tc, timelineStart: pos }
    pos += tc.duration
    return updated
  })
}
