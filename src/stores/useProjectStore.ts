import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  MediaClip, TimelineClip, ProjectSettings, ViewMode,
  SortField, FilterMode, ClipRating, ClipFlag, Marker,
  ColorLabel, SubClip, RecentProject, ProxyStatus,
  ColorCorrection, TransitionType, MusicTrack,
} from '../types'

interface ProjectState {
  // Project metadata
  settings: ProjectSettings
  projectPath: string | null
  isDirty: boolean
  recentProjects: RecentProject[]

  // Media library
  clips: MediaClip[]
  selectedClipId: string | null
  selectedClipIds: string[]   // multi-select

  // Timeline
  timelineClips: TimelineClip[]
  timelineCursorSeconds: number
  selectedTimelineClipId: string | null
  timelineToolMode: 'select' | 'blade'

  // Music
  musicTracks: MusicTrack[]

  // Player
  currentTime: number
  isPlaying: boolean
  playbackRate: number
  loopInOut: boolean
  volume: number
  audioBalance: number
  isFullscreen: boolean

  // Browser UI
  viewMode: ViewMode
  sortField: SortField
  sortAscending: boolean
  filterMode: FilterMode
  filterGroup: string | null
  searchQuery: string

  // Panels
  activePanel: 'inspector' | 'audio' | 'proxy'
  showTimeline: boolean
  timelineHeight: number

  // Import / proxy progress
  importing: boolean
  importTotal: number
  importProgress: number
  proxyQueue: string[]   // clip ids being proxied

  // ──────────────────────────────────────────
  // Actions
  // ──────────────────────────────────────────

  // Clips
  addClips: (clips: MediaClip[]) => void
  removeClip: (id: string) => void
  removeClips: (ids: string[]) => void
  updateClip: (id: string, patch: Partial<MediaClip>) => void
  selectClip: (id: string | null) => void

  // Multi-select
  toggleSelectClip: (id: string, additive: boolean) => void
  selectRange: (anchorId: string, targetId: string) => void
  selectAll: () => void
  clearMultiSelect: () => void

  // Batch ops on selectedClipIds
  batchSetFlag: (flag: ClipFlag) => void
  batchSetRating: (rating: ClipRating) => void
  batchSetGroup: (group: string) => void
  batchSetColorLabel: (label: ColorLabel) => void
  batchAddToTimeline: () => void

  // In/out
  setInPoint: (clipId: string, seconds: number) => void
  setOutPoint: (clipId: string, seconds: number) => void
  clearInPoint: (clipId: string) => void
  clearOutPoint: (clipId: string) => void

  // Rating / flag / label
  setRating: (clipId: string, rating: ClipRating) => void
  setFlag: (clipId: string, flag: ClipFlag) => void
  setColorLabel: (clipId: string, label: ColorLabel) => void

  // Markers
  addMarker: (clipId: string, marker: Marker) => void
  removeMarker: (clipId: string, markerId: string) => void

  // Subclips
  addSubClip: (clipId: string, subClip: SubClip) => void
  updateSubClip: (clipId: string, subClipId: string, patch: Partial<SubClip>) => void
  removeSubClip: (clipId: string, subClipId: string) => void

  // Proxy
  setProxyStatus: (clipId: string, status: ProxyStatus, proxyPath?: string) => void
  setUseProxy: (clipId: string, useProxy: boolean) => void
  addToProxyQueue: (clipId: string) => void
  removeFromProxyQueue: (clipId: string) => void

  // Timeline
  addToTimeline: (clipId: string) => void
  removeFromTimeline: (timelineClipId: string) => void
  reorderTimeline: (from: number, to: number) => void
  trimTimelineClip: (tcId: string, edge: 'in' | 'out', deltaSeconds: number) => void
  setTimelineCursor: (seconds: number) => void
  clearTimeline: () => void

  // Timeline clip editing
  splitTimelineClip: (tcId: string, atTimelineSeconds: number) => void
  rippleDeleteTimelineClip: (tcId: string) => void
  setTimelineClipSpeed: (tcId: string, speed: number) => void
  setTimelineClipColor: (tcId: string, patch: Partial<ColorCorrection>) => void
  setTimelineClipTransition: (tcId: string, edge: 'in' | 'out', type: TransitionType, duration: number) => void
  setTimelineClipVolume: (tcId: string, volume: number) => void
  selectTimelineClip: (tcId: string | null) => void
  setTimelineToolMode: (mode: 'select' | 'blade') => void

  // Music
  addMusicTrack: (track: MusicTrack) => void
  updateMusicTrack: (id: string, patch: Partial<MusicTrack>) => void
  removeMusicTrack: (id: string) => void

  // Player
  setCurrentTime: (t: number) => void
  setIsPlaying: (v: boolean) => void
  setPlaybackRate: (r: number) => void
  setLoopInOut: (v: boolean) => void
  setVolume: (v: number) => void
  setAudioBalance: (v: number) => void
  setIsFullscreen: (v: boolean) => void

  // Browser
  setViewMode: (m: ViewMode) => void
  setSortField: (f: SortField, ascending?: boolean) => void
  setFilterMode: (m: FilterMode) => void
  setFilterGroup: (g: string | null) => void
  setSearchQuery: (q: string) => void

  // UI layout
  setActivePanel: (p: 'inspector' | 'audio' | 'proxy') => void
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
  setRecentProjects: (projects: RecentProject[]) => void

  // Computed
  getSelectedClip: () => MediaClip | null
  getFilteredClips: () => MediaClip[]
  getGroups: () => string[]
  getFootageStats: () => { totalDuration: number; selectedDuration: number; picksCount: number; totalSize: number }
}

const DEFAULT_TC_FIELDS = {
  speed: 1,
  color: { brightness: 0, contrast: 1, saturation: 1 } as ColorCorrection,
  transitionIn: { type: 'none' as TransitionType, duration: 0 },
  transitionOut: { type: 'none' as TransitionType, duration: 0 },
}

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
    recentProjects: [],

    clips: [],
    selectedClipId: null,
    selectedClipIds: [],

    timelineClips: [],
    timelineCursorSeconds: 0,
    selectedTimelineClipId: null,
    timelineToolMode: 'select',

    musicTracks: [],

    currentTime: 0,
    isPlaying: false,
    playbackRate: 1,
    loopInOut: false,
    volume: 1,
    audioBalance: 0,
    isFullscreen: false,

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
    proxyQueue: [],

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
        selectedClipIds: s.selectedClipIds.filter((x) => x !== id),
        timelineClips: s.timelineClips.filter((tc) => tc.sourceClipId !== id),
        isDirty: true,
      })),

    removeClips: (ids) =>
      set((s) => ({
        clips: s.clips.filter((c) => !ids.includes(c.id)),
        selectedClipId: ids.includes(s.selectedClipId ?? '') ? null : s.selectedClipId,
        selectedClipIds: s.selectedClipIds.filter((x) => !ids.includes(x)),
        timelineClips: s.timelineClips.filter((tc) => !ids.includes(tc.sourceClipId)),
        isDirty: true,
      })),

    updateClip: (id, patch) =>
      set((s) => ({
        clips: s.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        isDirty: true,
      })),

    selectClip: (id) => set({ selectedClipId: id, currentTime: 0, isPlaying: false }),

    // ── Multi-select ───────────────────────────
    toggleSelectClip: (id, additive) =>
      set((s) => {
        if (!additive) {
          return { selectedClipIds: [id], selectedClipId: id }
        }
        const already = s.selectedClipIds.includes(id)
        const next = already
          ? s.selectedClipIds.filter((x) => x !== id)
          : [...s.selectedClipIds, id]
        return { selectedClipIds: next, selectedClipId: id }
      }),

    selectRange: (anchorId, targetId) =>
      set((s) => {
        const filtered = get().getFilteredClips()
        const ai = filtered.findIndex((c) => c.id === anchorId)
        const ti = filtered.findIndex((c) => c.id === targetId)
        if (ai === -1 || ti === -1) return {}
        const [lo, hi] = ai < ti ? [ai, ti] : [ti, ai]
        const ids = filtered.slice(lo, hi + 1).map((c) => c.id)
        return { selectedClipIds: ids, selectedClipId: targetId }
      }),

    selectAll: () =>
      set((_s) => ({
        selectedClipIds: get().getFilteredClips().map((c) => c.id),
      })),

    clearMultiSelect: () => set({ selectedClipIds: [] }),

    // ── Batch ops ──────────────────────────────
    batchSetFlag: (flag) =>
      set((s) => ({
        clips: s.clips.map((c) => s.selectedClipIds.includes(c.id) ? { ...c, flag } : c),
        isDirty: true,
      })),

    batchSetRating: (rating) =>
      set((s) => ({
        clips: s.clips.map((c) => s.selectedClipIds.includes(c.id) ? { ...c, rating } : c),
        isDirty: true,
      })),

    batchSetGroup: (group) =>
      set((s) => ({
        clips: s.clips.map((c) => s.selectedClipIds.includes(c.id) ? { ...c, group } : c),
        isDirty: true,
      })),

    batchSetColorLabel: (colorLabel) =>
      set((s) => ({
        clips: s.clips.map((c) => s.selectedClipIds.includes(c.id) ? { ...c, colorLabel } : c),
        isDirty: true,
      })),

    batchAddToTimeline: () => {
      const { selectedClipIds, clips, timelineClips } = get()
      const toAdd = selectedClipIds
        .map((id) => clips.find((c) => c.id === id))
        .filter(Boolean) as MediaClip[]

      let pos = timelineClips.reduce((s, tc) => s + tc.duration, 0)
      const newTCs: TimelineClip[] = []
      for (const clip of toAdd) {
        if (!clip.info) continue
        const inPt = clip.inPointSet ? clip.inPoint : 0
        const outPt = clip.outPointSet ? clip.outPoint : clip.info.duration
        const dur = outPt - inPt
        newTCs.push({
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          sourceClipId: clip.id,
          timelineStart: pos,
          duration: dur,
          inPoint: inPt,
          outPoint: outPt,
          volume: clip.volume,
          audioBalance: clip.audioBalance,
          trackIndex: 0,
          ...DEFAULT_TC_FIELDS,
        })
        pos += dur
      }
      set((s) => ({ timelineClips: [...s.timelineClips, ...newTCs], isDirty: true }))
    },

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

    // ── Rating / Flag / Label ──────────────────
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

    setColorLabel: (clipId, colorLabel) =>
      set((s) => ({
        clips: s.clips.map((c) => (c.id === clipId ? { ...c, colorLabel } : c)),
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

    // ── Subclips ───────────────────────────────
    addSubClip: (clipId, subClip) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, subClips: [...c.subClips, subClip] } : c
        ),
        isDirty: true,
      })),

    updateSubClip: (clipId, subClipId, patch) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId
            ? { ...c, subClips: c.subClips.map((sc) => sc.id === subClipId ? { ...sc, ...patch } : sc) }
            : c
        ),
        isDirty: true,
      })),

    removeSubClip: (clipId, subClipId) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId
            ? { ...c, subClips: c.subClips.filter((sc) => sc.id !== subClipId) }
            : c
        ),
        isDirty: true,
      })),

    // ── Proxy ──────────────────────────────────
    setProxyStatus: (clipId, proxyStatus, proxyPath) =>
      set((s) => ({
        clips: s.clips.map((c) =>
          c.id === clipId ? { ...c, proxyStatus, ...(proxyPath ? { proxyPath } : {}) } : c
        ),
        proxyQueue: proxyStatus === 'creating'
          ? [...s.proxyQueue, clipId]
          : s.proxyQueue.filter((id) => id !== clipId),
        isDirty: true,
      })),

    setUseProxy: (clipId, useProxy) =>
      set((s) => ({
        clips: s.clips.map((c) => c.id === clipId ? { ...c, useProxy } : c),
        isDirty: true,
      })),

    addToProxyQueue: (clipId) =>
      set((s) => ({ proxyQueue: [...s.proxyQueue, clipId] })),

    removeFromProxyQueue: (clipId) =>
      set((s) => ({ proxyQueue: s.proxyQueue.filter((id) => id !== clipId) })),

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
        ...DEFAULT_TC_FIELDS,
      }
      set((s) => ({ timelineClips: [...s.timelineClips, tc], isDirty: true }))
    },

    removeFromTimeline: (tcId) =>
      set((s) => ({
        timelineClips: recalcPositions(s.timelineClips.filter((tc) => tc.id !== tcId)),
        selectedTimelineClipId: s.selectedTimelineClipId === tcId ? null : s.selectedTimelineClipId,
        isDirty: true,
      })),

    reorderTimeline: (from, to) =>
      set((s) => {
        const arr = [...s.timelineClips]
        const [moved] = arr.splice(from, 1)
        arr.splice(to, 0, moved)
        return { timelineClips: recalcPositions(arr), isDirty: true }
      }),

    trimTimelineClip: (tcId, edge, deltaSeconds) =>
      set((s) => ({
        timelineClips: recalcPositions(
          s.timelineClips.map((tc) => {
            if (tc.id !== tcId) return tc
            const srcClip = s.clips.find((c) => c.id === tc.sourceClipId)
            const srcDur = srcClip?.info?.duration ?? 9999
            if (edge === 'in') {
              const newIn = Math.max(0, Math.min(tc.inPoint + deltaSeconds, tc.outPoint - 0.1))
              return { ...tc, inPoint: newIn, duration: tc.outPoint - newIn }
            } else {
              const newOut = Math.max(tc.inPoint + 0.1, Math.min(tc.outPoint + deltaSeconds, srcDur))
              return { ...tc, outPoint: newOut, duration: newOut - tc.inPoint }
            }
          })
        ),
        isDirty: true,
      })),

    setTimelineCursor: (seconds) => set({ timelineCursorSeconds: seconds }),
    clearTimeline: () => set({ timelineClips: [], selectedTimelineClipId: null, isDirty: true }),

    // ── Timeline clip editing ──────────────────
    splitTimelineClip: (tcId, atTimelineSeconds) =>
      set((s) => {
        const tc = s.timelineClips.find((t) => t.id === tcId)
        if (!tc) return {}

        const offset = atTimelineSeconds - tc.timelineStart
        if (offset <= 0.05 || offset >= tc.duration - 0.05) return {}

        const newInPoint1 = tc.inPoint
        const newOutPoint1 = tc.inPoint + offset
        const newInPoint2 = tc.inPoint + offset
        const newOutPoint2 = tc.outPoint

        const speed = tc.speed ?? 1
        const dur1 = (newOutPoint1 - newInPoint1) / speed
        const dur2 = (newOutPoint2 - newInPoint2) / speed

        const tc1: TimelineClip = {
          ...tc,
          id: `tc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          inPoint: newInPoint1,
          outPoint: newOutPoint1,
          duration: dur1,
          transitionOut: { type: 'none', duration: 0 },
        }
        const tc2: TimelineClip = {
          ...tc,
          id: `tc_${Date.now() + 1}_${Math.random().toString(36).slice(2)}`,
          inPoint: newInPoint2,
          outPoint: newOutPoint2,
          duration: dur2,
          transitionIn: { type: 'none', duration: 0 },
        }

        const withoutOriginal = s.timelineClips.filter((t) => t.id !== tcId)
        const idx = s.timelineClips.findIndex((t) => t.id === tcId)
        const next = [...withoutOriginal.slice(0, idx), tc1, tc2, ...withoutOriginal.slice(idx)]

        return {
          timelineClips: recalcPositions(next),
          selectedTimelineClipId: tc1.id,
          isDirty: true,
        }
      }),

    rippleDeleteTimelineClip: (tcId) =>
      set((s) => ({
        timelineClips: recalcPositions(s.timelineClips.filter((tc) => tc.id !== tcId)),
        selectedTimelineClipId: s.selectedTimelineClipId === tcId ? null : s.selectedTimelineClipId,
        isDirty: true,
      })),

    setTimelineClipSpeed: (tcId, speed) =>
      set((s) => {
        const updated = s.timelineClips.map((tc) => {
          if (tc.id !== tcId) return tc
          const clampedSpeed = Math.max(0.25, Math.min(4.0, speed))
          const newDuration = (tc.outPoint - tc.inPoint) / clampedSpeed
          return { ...tc, speed: clampedSpeed, duration: newDuration }
        })
        return { timelineClips: recalcPositions(updated), isDirty: true }
      }),

    setTimelineClipColor: (tcId, patch) =>
      set((s) => ({
        timelineClips: s.timelineClips.map((tc) =>
          tc.id === tcId ? { ...tc, color: { ...tc.color, ...patch } } : tc
        ),
        isDirty: true,
      })),

    setTimelineClipTransition: (tcId, edge, type, duration) =>
      set((s) => ({
        timelineClips: s.timelineClips.map((tc) => {
          if (tc.id !== tcId) return tc
          if (edge === 'in') {
            return { ...tc, transitionIn: { type, duration } }
          } else {
            return { ...tc, transitionOut: { type, duration } }
          }
        }),
        isDirty: true,
      })),

    setTimelineClipVolume: (tcId, volume) =>
      set((s) => ({
        timelineClips: s.timelineClips.map((tc) =>
          tc.id === tcId ? { ...tc, volume } : tc
        ),
        isDirty: true,
      })),

    selectTimelineClip: (tcId) => set({ selectedTimelineClipId: tcId }),

    setTimelineToolMode: (mode) => set({ timelineToolMode: mode }),

    // ── Music ──────────────────────────────────
    addMusicTrack: (track) =>
      set((s) => ({ musicTracks: [...s.musicTracks, track], isDirty: true })),

    updateMusicTrack: (id, patch) =>
      set((s) => ({
        musicTracks: s.musicTracks.map((mt) => mt.id === id ? { ...mt, ...patch } : mt),
        isDirty: true,
      })),

    removeMusicTrack: (id) =>
      set((s) => ({
        musicTracks: s.musicTracks.filter((mt) => mt.id !== id),
        isDirty: true,
      })),

    // ── Player ─────────────────────────────────
    setCurrentTime: (t) => set({ currentTime: t }),
    setIsPlaying: (v) => set({ isPlaying: v }),
    setPlaybackRate: (r) => set({ playbackRate: r }),
    setLoopInOut: (v) => set({ loopInOut: v }),
    setVolume: (v) => set({ volume: v }),
    setAudioBalance: (v) => set({ audioBalance: v }),
    setIsFullscreen: (v) => set({ isFullscreen: v }),

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
    loadProject: (state) => {
      // Merge defaults for new fields on loaded timeline clips
      const merged = {
        ...state,
        timelineClips: (state.timelineClips ?? []).map((tc) => ({
          ...DEFAULT_TC_FIELDS,
          ...tc,
        })),
        musicTracks: state.musicTracks ?? [],
        selectedTimelineClipId: null,
        timelineToolMode: 'select' as const,
        isDirty: false,
      }
      set(merged)
    },
    setRecentProjects: (projects) => set({ recentProjects: projects }),

    // ── Computed ───────────────────────────────
    getSelectedClip: () => {
      const { clips, selectedClipId } = get()
      return clips.find((c) => c.id === selectedClipId) ?? null
    },

    getFilteredClips: () => {
      const { clips, filterMode, filterGroup, searchQuery, sortField, sortAscending } = get()
      let result = [...clips]
      switch (filterMode) {
        case 'picks':   result = result.filter((c) => c.flag === 'pick'); break
        case 'rejects': result = result.filter((c) => c.flag === 'reject'); break
        case 'review':  result = result.filter((c) => c.flag === 'review'); break
        case 'unrated': result = result.filter((c) => c.rating === 0 && c.flag === 'none'); break
      }
      if (filterGroup) result = result.filter((c) => c.group === filterGroup)
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        result = result.filter((c) =>
          c.fileName.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q) ||
          c.reelName.toLowerCase().includes(q)
        )
      }
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

    getFootageStats: () => {
      const { clips, selectedClipIds } = get()
      const totalDuration = clips.reduce((s, c) => s + (c.info?.duration ?? 0), 0)
      const selectedDuration = selectedClipIds.length > 0
        ? clips
            .filter((c) => selectedClipIds.includes(c.id))
            .reduce((s, c) => {
              const inPt = c.inPointSet ? c.inPoint : 0
              const outPt = c.outPointSet ? c.outPoint : (c.info?.duration ?? 0)
              return s + (outPt - inPt)
            }, 0)
        : clips.reduce((s, c) => {
            const inPt = c.inPointSet ? c.inPoint : 0
            const outPt = c.outPointSet ? c.outPoint : (c.info?.duration ?? 0)
            return s + (outPt - inPt)
          }, 0)
      const picksCount = clips.filter((c) => c.flag === 'pick').length
      const totalSize = clips.reduce((s, c) => s + (c.info?.size ?? 0), 0)
      return { totalDuration, selectedDuration, picksCount, totalSize }
    },
  }))
)

function recalcPositions(clips: TimelineClip[]): TimelineClip[] {
  let pos = 0
  return clips.map((tc) => {
    const updated = { ...tc, timelineStart: pos }
    pos += tc.duration
    return updated
  })
}
