# IMG Weddings Preedit

**Wedding footage pre-editing suite for macOS** — review, cut, select, balance audio, and export XML for Premiere Pro and DaVinci Resolve. Built with the Apple OS 26 "Liquid Glass" design language.

---

## Features

### Media Management
- Import individual files or entire folders (auto-scans for video recursively)
- Drag and drop from Finder directly onto the window
- Filmstrip, list, and icon view modes
- Search, sort (name / duration / rating / date), and filter
- Group clips by scene (Ceremony, Reception, Getting Ready, etc.)
- Camera / reel name tagging

### Video Player
- Native HTML5 player via Electron/Chromium — supports MP4, MOV, H.264, HEVC
- **JKL transport** — J=rewind, K=pause, L=forward (hold for faster)
- Frame-by-frame stepping with `←` / `→`
- **Set In/Out points** with `I` / `O` keyboard shortcuts
- Clear in/out with `X`
- Loop in/out range with `Repeat` button
- Adjustable playback speed (0.25× – 4×)
- Add markers with `M`
- Per-clip volume control
- Timecode display (HH:MM:SS:FF)

### Rating & Flagging
- 5-star ratings
- Flag as **Pick** (green), **Review** (yellow), **Reject** (red)
- Filter browser by flag status

### Audio Panel
- FFmpeg-extracted waveform visualization
- Animated VU meter during playback
- Per-clip volume adjust (0–200%)
- Per-clip stereo balance (L–R)

### Timeline
- Sequential timeline with drag-to-reorder clips
- Zoom in/out (0.2× – 8×)
- Timecode ruler
- Video + Audio tracks visualized
- Add clips with `E` key or the "Timeline" button
- Remove clips, clear timeline

### Export
| Format | Compatible with |
|--------|----------------|
| **FCPXML 1.10** | Final Cut Pro X, DaVinci Resolve 18+, Premiere (via panel) |
| **XMEML / FCP7 XML** | Adobe Premiere Pro (native), DaVinci Resolve, Avid |
| **EDL (CMX 3600)** | All NLEs, color grading suites |
| **CSV Log** | Excel, Numbers, Google Sheets, billing |

All formats include:
- In/out points
- Source file paths
- Clip metadata (duration, timecode, reel)
- Volume / audio info
- Timeline sequence (if built)

### Project Files
- Save as `.imgpre` (JSON) — preserves all clips, in/out, ratings, markers, notes, timeline
- Reopen projects to continue work

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` / `K` | Play / Pause |
| `J` | Rewind (hold to accelerate) |
| `L` | Fast forward (hold to accelerate) |
| `←` / `→` | Previous / next frame |
| `Shift+←/→` | Jump 1 second |
| `I` | Set In point |
| `O` | Set Out point |
| `X` | Clear In/Out |
| `E` | Add clip to timeline |
| `M` | Add marker |
| `Home` | Jump to In point |
| `End` | Jump to Out point |
| `⌘I` | Import files |
| `⌘⇧I` | Import folder |
| `⌘S` | Save project |
| `⌘E` | Export XML |

---

## Requirements

- **macOS 13+** (Ventura or later)
- **FFmpeg + FFprobe** — install via Homebrew: `brew install ffmpeg`
- **Node.js 20+** (for development)

---

## Development

```bash
# Install dependencies
npm install

# Run in development (opens Electron with hot reload)
npm run electron:dev

# Build distributable .dmg
npm run electron:build
```

---

## Stack

- **Electron 34** — native macOS app
- **React 18 + TypeScript** — UI
- **Zustand** — state management
- **Tailwind CSS v3** — Apple OS 26 Liquid Glass styling
- **FFmpeg / FFprobe** — video metadata, thumbnails, waveforms
- **Vite + vite-plugin-electron** — build tooling

---

## Design

Follows the **Apple macOS 26 "Liquid Glass"** design language:
- Near-black surface (`#06060c`)
- Translucent frosted glass panels (`rgba(255,255,255,0.05)` + `backdrop-filter: blur(40px)`)
- System font stack (`-apple-system, SF Pro Display`)
- Rose champagne accent color for wedding context
- Custom hidden-inset titlebar with native traffic lights
- macOS vibrancy window material

---

Made by **IMG Creative Co.**
