/**
 * XML Export utilities
 * Supports:
 *   - FCPXML 1.10  (Final Cut Pro X, DaVinci Resolve 18+, Premiere via plugin)
 *   - XMEML 5      (FCP7 XML — Premiere Pro native import, DaVinci Resolve)
 *   - EDL          (CMX3600 — universal)
 *   - CSV          (spreadsheet log)
 */

import type { MediaClip, TimelineClip, ProjectSettings } from '../types'
import { formatTimecode, secondsToFrames } from './timecode'

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function fileUrl(filePath: string): string {
  // On macOS paths are already absolute
  return `file://${filePath.replace(/ /g, '%20')}`
}

function toRational(seconds: number, fps: number): string {
  // Express seconds as a rational fraction (for FCPXML)
  if (seconds === 0) return '0s'
  const frames = Math.round(seconds * fps)
  const fpsTicks = Math.round(fps * 100)
  return `${frames * 100}/${fpsTicks}s`
}

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ──────────────────────────────────────────────
// FCPXML 1.10
// ──────────────────────────────────────────────
export function generateFCPXML(
  settings: ProjectSettings,
  clips: MediaClip[],
  timeline: TimelineClip[]
): string {
  const fps = settings.frameRate
  const { width, height } = settings.resolution

  // Build resource entries
  const formatId = 'r1'
  const assetEntries = clips.map((clip, i) => {
    const info = clip.info
    const dur = info?.duration ?? 0
    return `    <asset id="r${i + 2}" name="${xmlEscape(clip.fileName)}" uid="${clip.id}" src="${fileUrl(clip.filePath)}" hasVideo="1" hasAudio="${info?.audioCodec ? '1' : '0'}" duration="${toRational(dur, fps)}" format="${formatId}">
      <media-rep kind="original-media" src="${fileUrl(clip.filePath)}"/>
    </asset>`
  }).join('\n')

  // Build clip index map
  const clipIdToResourceId: Record<string, string> = {}
  clips.forEach((clip, i) => { clipIdToResourceId[clip.id] = `r${i + 2}` })

  // Build spine items from timeline
  let spineXml = ''
  if (timeline.length > 0) {
    const spineItems = timeline.map((tc) => {
      const srcClip = clips.find((c) => c.id === tc.sourceClipId)
      if (!srcClip) return ''
      const resId = clipIdToResourceId[tc.sourceClipId]
      const offset = toRational(tc.timelineStart, fps)
      const duration = toRational(tc.duration, fps)
      const start = toRational(tc.inPoint, fps)
      return `          <clip name="${xmlEscape(srcClip.fileName)}" ref="${resId}" offset="${offset}" duration="${duration}" start="${start}">
            <adjust-volume amount="${tc.volume === 1 ? '0dB' : `${((tc.volume - 1) * 20).toFixed(1)}dB`}"/>
          </clip>`
    }).filter(Boolean).join('\n')

    spineXml = `
      <project name="${xmlEscape(settings.name)}">
        <sequence duration="${toRational(timeline.reduce((s, tc) => s + tc.duration, 0), fps)}" format="${formatId}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${spineItems}
          </spine>
        </sequence>
      </project>`
  }

  // Build selects (clips with in/out)
  const selectItems = clips
    .filter((c) => c.inPointSet || c.outPointSet || c.flag === 'pick')
    .map((clip) => {
      const resId = clipIdToResourceId[clip.id]
      const inPt = clip.inPointSet ? clip.inPoint : 0
      const outPt = clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)
      const dur = outPt - inPt
      return `      <clip name="${xmlEscape(clip.fileName)}" ref="${resId}" offset="0s" duration="${toRational(dur, fps)}" start="${toRational(inPt, fps)}">
        <note>${xmlEscape(clip.notes || '')}</note>
      </clip>`
    }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="${formatId}" name="FFVideoFormat${height}p${fps}" frameDuration="${Math.round(100 / fps)}/100s" width="${width}" height="${height}" colorSpace="1-1-1 (Rec. 709)"/>
${assetEntries}
  </resources>
  <library location="${fileUrl(settings.outputDir || '/')}">
    <event name="${xmlEscape(settings.name)} — ${settings.couple}">
${spineXml}
      <project name="${xmlEscape(settings.name)} — Selects">
        <sequence duration="${toRational(clips.reduce((s, c) => s + (c.outPointSet ? c.outPoint : (c.info?.duration ?? 0)) - (c.inPointSet ? c.inPoint : 0), 0), fps)}" format="${formatId}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${selectItems}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`
}

// ──────────────────────────────────────────────
// XMEML 5 (Final Cut Pro 7 XML)
// Compatible with: Premiere Pro, DaVinci Resolve, Avid (via roundtrip)
// ──────────────────────────────────────────────
export function generateXMEML(
  settings: ProjectSettings,
  clips: MediaClip[],
  timeline: TimelineClip[]
): string {
  const fps = settings.frameRate
  const { width, height } = settings.resolution

  // File resources
  const fileResources = clips.map((clip, i) => {
    const info = clip.info
    return `    <file id="file-${i + 1}">
      <name>${xmlEscape(clip.fileName)}</name>
      <pathurl>${fileUrl(clip.filePath)}</pathurl>
      <rate>
        <timebase>${fps}</timebase>
        <ntsc>FALSE</ntsc>
      </rate>
      <duration>${Math.round((info?.duration ?? 0) * fps)}</duration>
      <media>
        <video>
          <samplecharacteristics>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <width>${width}</width>
            <height>${height}</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
          </samplecharacteristics>
        </video>
        ${info?.audioCodec ? `<audio>
          <samplecharacteristics>
            <depth>16</depth>
            <samplerate>${info.audioSampleRate || 48000}</samplerate>
          </samplecharacteristics>
          <channelcount>${info.audioChannels || 2}</channelcount>
        </audio>` : ''}
      </media>
    </file>`
  }).join('\n')

  // Clip index map
  const clipToFileId: Record<string, number> = {}
  clips.forEach((clip, i) => { clipToFileId[clip.id] = i + 1 })

  // Timeline clip items
  const timelineItems = timeline.map((tc, idx) => {
    const srcClip = clips.find((c) => c.id === tc.sourceClipId)
    if (!srcClip) return ''
    const fileId = clipToFileId[tc.sourceClipId]
    const inFrames = Math.round(tc.inPoint * fps)
    const outFrames = Math.round(tc.outPoint * fps)
    const startFrame = Math.round(tc.timelineStart * fps)
    const endFrame = startFrame + Math.round(tc.duration * fps)
    const vol = Math.round(tc.volume * 100)

    return `        <clipitem id="clipitem-${idx + 1}">
          <name>${xmlEscape(srcClip.fileName)}</name>
          <enabled>TRUE</enabled>
          <duration>${outFrames - inFrames}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <in>${inFrames}</in>
          <out>${outFrames}</out>
          <start>${startFrame}</start>
          <end>${endFrame}</end>
          <file id="file-${fileId}"/>
          <compositemode>normal</compositemode>
          <filter>
            <effect>
              <name>Audio Levels</name>
              <effectid>audiolevels</effectid>
              <effectcategory>audiolevels</effectcategory>
              <effecttype>audiolevels</effecttype>
              <mediatype>audio</mediatype>
              <parameter>
                <parameterid>level</parameterid>
                <name>Level</name>
                <value>${vol}</value>
              </parameter>
            </effect>
          </filter>
        </clipitem>`
  }).filter(Boolean).join('\n')

  // Selects project
  const selectItems = clips
    .filter((c) => c.inPointSet || c.outPointSet || c.flag === 'pick')
    .map((clip, idx) => {
      const fileId = clipToFileId[clip.id]
      const inPt = clip.inPointSet ? clip.inPoint : 0
      const outPt = clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)
      const inFrames = Math.round(inPt * fps)
      const outFrames = Math.round(outPt * fps)
      const dur = outFrames - inFrames
      return `        <clipitem id="select-${idx + 1}">
          <name>${xmlEscape(clip.fileName)}</name>
          <enabled>TRUE</enabled>
          <duration>${dur}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <in>${inFrames}</in>
          <out>${outFrames}</out>
          <start>${idx === 0 ? 0 : -1}</start>
          <end>-1</end>
          <file id="file-${fileId}"/>
          <note>${xmlEscape(clip.notes || '')}</note>
        </clipitem>`
    }).join('\n')

  const totalFrames = Math.round(timeline.reduce((s, tc) => s + tc.duration, 0) * fps)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="sequence-1">
    <name>${xmlEscape(settings.name)}</name>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <duration>${totalFrames}</duration>
    <timecode>
      <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
      <string>00:00:00:00</string>
      <frame>0</frame>
      <displayformat>NDF</displayformat>
    </timecode>
    <media>
      <video>
        <format>
          <samplecharacteristics>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <width>${width}</width>
            <height>${height}</height>
            <anamorphic>FALSE</anamorphic>
            <pixelaspectratio>square</pixelaspectratio>
            <fielddominance>none</fielddominance>
            <colordepth>32</colordepth>
          </samplecharacteristics>
        </format>
        <track>
${timelineItems}
        </track>
      </video>
      <audio>
        <track>
${timelineItems.replace(/clipitem-/g, 'audio-clipitem-')}
        </track>
      </audio>
    </media>
  </sequence>
  <!-- Selects / Marked Clips -->
  <sequence id="sequence-selects">
    <name>${xmlEscape(settings.name)} — Selects</name>
    <rate>
      <timebase>${fps}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <track>
${selectItems}
        </track>
      </video>
    </media>
  </sequence>
  <!-- File Resources -->
  <bin>
    <name>Media</name>
    <children>
${fileResources}
    </children>
  </bin>
</xmeml>`
}

// ──────────────────────────────────────────────
// CMX3600 EDL
// ──────────────────────────────────────────────
export function generateEDL(
  settings: ProjectSettings,
  clips: MediaClip[],
  timeline: TimelineClip[]
): string {
  const fps = settings.frameRate
  const clipMap: Record<string, MediaClip> = {}
  clips.forEach((c) => { clipMap[c.id] = c })

  const lines: string[] = [
    `TITLE: ${settings.name} — ${settings.couple}`,
    `FCM: NON-DROP FRAME`,
    '',
  ]

  // If timeline is populated, export that. Otherwise export all marked clips.
  const source = timeline.length > 0
    ? timeline.map((tc) => ({
        reel: clipMap[tc.sourceClipId]?.reelName || clipMap[tc.sourceClipId]?.fileName.slice(0, 8).toUpperCase() || 'AX',
        name: clipMap[tc.sourceClipId]?.fileName || '',
        srcIn: tc.inPoint,
        srcOut: tc.outPoint,
        recIn: tc.timelineStart,
        recOut: tc.timelineStart + tc.duration,
      }))
    : clips
        .filter((c) => c.inPointSet || c.outPointSet || c.flag === 'pick')
        .reduce<typeof timeline>((acc, c, i) => {
          const prev = acc[acc.length - 1]
          const recIn = prev ? (prev as any).recOut : 0
          const duration = (c.outPointSet ? c.outPoint : (c.info?.duration ?? 0)) - (c.inPointSet ? c.inPoint : 0)
          acc.push({
            id: '',
            sourceClipId: c.id,
            timelineStart: recIn,
            duration,
            inPoint: c.inPointSet ? c.inPoint : 0,
            outPoint: c.outPointSet ? c.outPoint : (c.info?.duration ?? 0),
            volume: c.volume,
            audioBalance: c.audioBalance,
            trackIndex: 0,
          })
          return acc
        }, []).map((tc) => ({
          reel: clipMap[tc.sourceClipId]?.reelName || 'AX',
          name: clipMap[tc.sourceClipId]?.fileName || '',
          srcIn: tc.inPoint,
          srcOut: tc.outPoint,
          recIn: tc.timelineStart,
          recOut: tc.timelineStart + tc.duration,
        }))

  source.forEach((item, idx) => {
    const num = String(idx + 1).padStart(3, '0')
    const reel = item.reel.slice(0, 8).padEnd(8, ' ')
    const srcIn = formatTimecode(item.srcIn, fps)
    const srcOut = formatTimecode(item.srcOut, fps)
    const recIn = formatTimecode(item.recIn, fps)
    const recOut = formatTimecode(item.recOut, fps)
    lines.push(`${num}  ${reel}  V  C  ${srcIn} ${srcOut} ${recIn} ${recOut}`)
    lines.push(`* FROM CLIP NAME: ${item.name}`)
    lines.push('')
  })

  return lines.join('\n')
}

// ──────────────────────────────────────────────
// CSV Log Export
// ──────────────────────────────────────────────
export function generateCSV(clips: MediaClip[], fps: number): string {
  const header = 'Filename,Duration,In Point,Out Point,Rating,Flag,Notes,Group,Reel,Codec,Resolution,FPS'
  const rows = clips.map((c) => {
    const dur = c.info?.duration ?? 0
    const inPt = c.inPointSet ? formatTimecode(c.inPoint, fps) : '00:00:00:00'
    const outPt = c.outPointSet ? formatTimecode(c.outPoint, fps) : formatTimecode(dur, fps)
    const res = c.info ? `${c.info.width}x${c.info.height}` : ''
    return [
      `"${c.fileName}"`,
      formatTimecode(dur, fps),
      inPt,
      outPt,
      c.rating,
      c.flag,
      `"${c.notes.replace(/"/g, '""')}"`,
      `"${c.group}"`,
      `"${c.reelName}"`,
      c.info?.codec ?? '',
      res,
      c.info?.fps ?? fps,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}
