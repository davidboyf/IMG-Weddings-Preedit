/**
 * XML Export utilities
 * Formats:
 *   FCPXML 1.10  — Final Cut Pro X, DaVinci Resolve 18+
 *   XMEML 5      — Premiere Pro (native), DaVinci Resolve, Avid
 *   AAF-XML      — Avid/Premiere-compatible audio-track XML
 *   DaVinci XML  — Resolve-optimised FCPXML with metadata extensions
 *   EDL          — CMX3600 universal
 *   CSV          — Spreadsheet log
 */

import type { MediaClip, TimelineClip, ProjectSettings } from '../types'
import { formatTimecode } from './timecode'

// ── Shared helpers ─────────────────────────────
function fileUrl(p: string): string {
  return `file://${p.replace(/ /g, '%20')}`
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function toRational(seconds: number, fps: number): string {
  if (seconds === 0) return '0s'
  const frames = Math.round(seconds * fps)
  const fpsTicks = Math.round(fps * 100)
  return `${frames * 100}/${fpsTicks}s`
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function secondsToTC(seconds: number, fps: number): string {
  return formatTimecode(seconds, fps)
}

// ──────────────────────────────────────────────
// 1. FCPXML 1.10
// ──────────────────────────────────────────────
export function generateFCPXML(
  settings: ProjectSettings,
  clips: MediaClip[],
  timeline: TimelineClip[]
): string {
  const fps = settings.frameRate
  const { width, height } = settings.resolution
  const formatId = 'r1'

  const assetEntries = clips.map((clip, i) => {
    const dur = clip.info?.duration ?? 0
    return `    <asset id="r${i + 2}" name="${xmlEscape(clip.fileName)}" uid="${clip.id}" src="${fileUrl(clip.filePath)}" hasVideo="1" hasAudio="${clip.info?.audioCodec ? '1' : '0'}" duration="${toRational(dur, fps)}" format="${formatId}">
      <media-rep kind="original-media" src="${fileUrl(clip.filePath)}"/>
    </asset>`
  }).join('\n')

  const assetMap: Record<string, string> = {}
  clips.forEach((c, i) => { assetMap[c.id] = `r${i + 2}` })

  const timelineSpine = timeline.map((tc) => {
    const src = clips.find((c) => c.id === tc.sourceClipId)
    if (!src) return ''
    return `          <clip name="${xmlEscape(src.fileName)}" ref="${assetMap[tc.sourceClipId]}" offset="${toRational(tc.timelineStart, fps)}" duration="${toRational(tc.duration, fps)}" start="${toRational(tc.inPoint, fps)}">
            <adjust-volume amount="${tc.volume === 1 ? '0dB' : `${((tc.volume - 1) * 20).toFixed(1)}dB`}"/>
          </clip>`
  }).filter(Boolean).join('\n')

  const selectSpine = clips
    .filter((c) => c.inPointSet || c.outPointSet || c.flag === 'pick')
    .map((clip) => {
      const inPt = clip.inPointSet ? clip.inPoint : 0
      const outPt = clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)
      return `      <clip name="${xmlEscape(clip.fileName)}" ref="${assetMap[clip.id]}" offset="0s" duration="${toRational(outPt - inPt, fps)}" start="${toRational(inPt, fps)}">
        <note>${xmlEscape(clip.notes)}</note>
      </clip>`
    }).join('\n')

  const totalTimelineDur = toRational(timeline.reduce((s, tc) => s + tc.duration, 0), fps)

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="${formatId}" name="FFVideoFormat${height}p${fps}" frameDuration="${Math.round(100 / fps)}/100s" width="${width}" height="${height}" colorSpace="1-1-1 (Rec. 709)"/>
${assetEntries}
  </resources>
  <library location="${fileUrl(settings.outputDir || '/')}">
    <event name="${xmlEscape(settings.name)} — ${xmlEscape(settings.couple)}">
      ${timeline.length ? `<project name="${xmlEscape(settings.name)} — Timeline">
        <sequence duration="${totalTimelineDur}" format="${formatId}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${timelineSpine}
          </spine>
        </sequence>
      </project>` : ''}
      <project name="${xmlEscape(settings.name)} — Selects">
        <sequence duration="${toRational(clips.filter(c => c.inPointSet || c.outPointSet || c.flag === 'pick').reduce((s, c) => s + (c.outPointSet ? c.outPoint : (c.info?.duration ?? 0)) - (c.inPointSet ? c.inPoint : 0), 0), fps)}" format="${formatId}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
${selectSpine}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`
}

// ──────────────────────────────────────────────
// 2. XMEML 5 (FCP7 / Premiere Pro XML)
// ──────────────────────────────────────────────
export function generateXMEML(
  settings: ProjectSettings,
  clips: MediaClip[],
  timeline: TimelineClip[]
): string {
  const fps = settings.frameRate
  const { width, height } = settings.resolution

  const fileResources = clips.map((clip, i) => {
    const info = clip.info
    return `    <file id="file-${i + 1}">
      <name>${xmlEscape(clip.fileName)}</name>
      <pathurl>${fileUrl(clip.filePath)}</pathurl>
      <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
      <duration>${Math.round((info?.duration ?? 0) * fps)}</duration>
      <timecode><rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate><string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>
      <media>
        <video>
          <samplecharacteristics>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <width>${width}</width><height>${height}</height>
            <anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance>
          </samplecharacteristics>
        </video>
        ${info?.audioCodec ? `<audio>
          <samplecharacteristics><depth>16</depth><samplerate>${info.audioSampleRate || 48000}</samplerate></samplecharacteristics>
          <channelcount>${info.audioChannels || 2}</channelcount>
        </audio>` : ''}
      </media>
    </file>`
  }).join('\n')

  const fileIdMap: Record<string, number> = {}
  clips.forEach((c, i) => { fileIdMap[c.id] = i + 1 })

  const buildClipItem = (tc: TimelineClip, idx: number, prefix: string) => {
    const src = clips.find((c) => c.id === tc.sourceClipId)
    if (!src) return ''
    const inF  = Math.round(tc.inPoint * fps)
    const outF = Math.round(tc.outPoint * fps)
    const stF  = Math.round(tc.timelineStart * fps)
    const endF = stF + Math.round(tc.duration * fps)
    return `        <clipitem id="${prefix}-${idx + 1}">
          <name>${xmlEscape(src.fileName)}</name>
          <enabled>TRUE</enabled>
          <duration>${outF - inF}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <in>${inF}</in><out>${outF}</out>
          <start>${stF}</start><end>${endF}</end>
          <file id="file-${fileIdMap[tc.sourceClipId]}"/>
          <note>${xmlEscape(src.notes)}</note>
          <filter><effect>
            <name>Audio Levels</name><effectid>audiolevels</effectid>
            <effectcategory>audiolevels</effectcategory><effecttype>audiolevels</effecttype><mediatype>audio</mediatype>
            <parameter><parameterid>level</parameterid><name>Level</name><value>${Math.round(tc.volume * 100)}</value></parameter>
          </effect></filter>
        </clipitem>`
  }

  const timelineItems = timeline.map((tc, i) => buildClipItem(tc, i, 'clipitem')).filter(Boolean).join('\n')
  const totalFrames = Math.round(timeline.reduce((s, tc) => s + tc.duration, 0) * fps)

  const selectItems = clips
    .filter((c) => c.inPointSet || c.outPointSet || c.flag === 'pick')
    .map((clip, idx) => {
      const inF = Math.round((clip.inPointSet ? clip.inPoint : 0) * fps)
      const outF = Math.round((clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)) * fps)
      return `        <clipitem id="select-${idx + 1}">
          <name>${xmlEscape(clip.fileName)}</name>
          <enabled>TRUE</enabled>
          <duration>${outF - inF}</duration>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <in>${inF}</in><out>${outF}</out>
          <start>-1</start><end>-1</end>
          <file id="file-${fileIdMap[clip.id]}"/>
          <note>${xmlEscape(clip.notes)}</note>
        </clipitem>`
    }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
  ${timeline.length ? `<sequence id="sequence-timeline">
    <name>${xmlEscape(settings.name)} — Timeline</name>
    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
    <duration>${totalFrames}</duration>
    <timecode><rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate><string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>
    <media>
      <video><format><samplecharacteristics>
        <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
        <width>${width}</width><height>${height}</height>
        <anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance><colordepth>32</colordepth>
      </samplecharacteristics></format>
        <track>${timelineItems}</track>
      </video>
      <audio><track>${timelineItems.replace(/clipitem-/g, 'audioclip-')}</track></audio>
    </media>
  </sequence>` : ''}
  <sequence id="sequence-selects">
    <name>${xmlEscape(settings.name)} — Selects</name>
    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
    <media>
      <video><track>${selectItems}</track></video>
    </media>
  </sequence>
  <bin><name>Media</name><children>${fileResources}</children></bin>
</xmeml>`
}

// ──────────────────────────────────────────────
// 3. AAF-compatible XML (Avid / Premiere audio routing)
//    Full binary AAF requires AAF SDK; this generates
//    an XMEML-based XML with complete audio track metadata
//    that Premiere imports via "File > Import" as AAF-XML
// ──────────────────────────────────────────────
export function generateAAF(
  settings: ProjectSettings,
  clips: MediaClip[],
  timeline: TimelineClip[]
): string {
  const fps = settings.frameRate
  const { width, height } = settings.resolution
  const fileIdMap: Record<string, number> = {}
  clips.forEach((c, i) => { fileIdMap[c.id] = i + 1 })

  const fileResources = clips.map((clip, i) => {
    const info = clip.info
    return `    <file id="file-${i + 1}">
      <name>${xmlEscape(clip.fileName)}</name>
      <pathurl>${fileUrl(clip.filePath)}</pathurl>
      <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
      <duration>${Math.round((info?.duration ?? 0) * fps)}</duration>
      <media>
        <video><samplecharacteristics>
          <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
          <width>${width}</width><height>${height}</height><pixelaspectratio>square</pixelaspectratio>
        </samplecharacteristics></video>
        <audio>
          <samplecharacteristics><depth>24</depth><samplerate>48000</samplerate></samplecharacteristics>
          <channelcount>${info?.audioChannels || 2}</channelcount>
        </audio>
      </media>
    </file>`
  }).join('\n')

  const buildAudioTracks = (channels: number) =>
    Array.from({ length: channels }, (_, ch) => `        <track>
          <enabled>TRUE</enabled>
          <locked>FALSE</locked>
          ${timeline.map((tc, idx) => {
            const src = clips.find((c) => c.id === tc.sourceClipId)
            if (!src) return ''
            const inF  = Math.round(tc.inPoint * fps)
            const outF = Math.round(tc.outPoint * fps)
            const stF  = Math.round(tc.timelineStart * fps)
            // Pan: left channel -1, right +1, else 0
            const pan = ch === 0 ? -1 : ch === 1 ? 1 : 0
            return `          <clipitem id="aac-${ch}-${idx}">
              <name>${xmlEscape(src.fileName)}</name><enabled>TRUE</enabled>
              <duration>${outF - inF}</duration>
              <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
              <in>${inF}</in><out>${outF}</out><start>${stF}</start><end>${stF + (outF - inF)}</end>
              <file id="file-${fileIdMap[tc.sourceClipId]}"/>
              <sourcetrack><mediatype>audio</mediatype><trackindex>${ch + 1}</trackindex></sourcetrack>
              <filter><effect>
                <name>Audio Levels</name><effectid>audiolevels</effectid><mediatype>audio</mediatype>
                <parameter><parameterid>level</parameterid><value>${Math.round(tc.volume * 100)}</value></parameter>
              </effect></filter>
              <filter><effect>
                <name>Pan</name><effectid>audiopan</effectid><mediatype>audio</mediatype>
                <parameter><parameterid>pan</parameterid><value>${pan}</value></parameter>
              </effect></filter>
            </clipitem>`
          }).filter(Boolean).join('\n')}
        </track>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- AAF-Compatible XML for Adobe Premiere Pro / Avid Media Composer -->
<!-- Import via File > Import in Premiere Pro -->
<!DOCTYPE xmeml>
<xmeml version="5">
  <sequence id="aaf-sequence-1">
    <name>${xmlEscape(settings.name)} — AAF Export</name>
    <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
    <duration>${Math.round(timeline.reduce((s, tc) => s + tc.duration, 0) * fps)}</duration>
    <timecode><rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate><string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>
    <media>
      <video><format><samplecharacteristics>
        <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
        <width>${width}</width><height>${height}</height>
        <pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance><colordepth>32</colordepth>
      </samplecharacteristics></format>
        <track>
          ${timeline.map((tc, idx) => {
            const src = clips.find((c) => c.id === tc.sourceClipId)
            if (!src) return ''
            const inF = Math.round(tc.inPoint * fps)
            const outF = Math.round(tc.outPoint * fps)
            const stF = Math.round(tc.timelineStart * fps)
            return `<clipitem id="vi-${idx}">
            <name>${xmlEscape(src.fileName)}</name><enabled>TRUE</enabled>
            <duration>${outF - inF}</duration>
            <rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>
            <in>${inF}</in><out>${outF}</out><start>${stF}</start><end>${stF + (outF - inF)}</end>
            <file id="file-${fileIdMap[tc.sourceClipId]}"/>
          </clipitem>`
          }).filter(Boolean).join('\n')}
        </track>
      </video>
      <audio>
${buildAudioTracks(2)}
      </audio>
    </media>
  </sequence>
  <bin><name>Media</name><children>${fileResources}</children></bin>
</xmeml>`
}

// ──────────────────────────────────────────────
// 4. DaVinci Resolve XML
//    Resolve-optimised FCPXML with DaVinci metadata
//    extensions (color space, grade notes, reel)
// ──────────────────────────────────────────────
export function generateDaVinciXML(
  settings: ProjectSettings,
  clips: MediaClip[],
  timeline: TimelineClip[]
): string {
  const fps = settings.frameRate
  const { width, height } = settings.resolution
  const formatId = 'r1'

  const assetMap: Record<string, string> = {}
  clips.forEach((c, i) => { assetMap[c.id] = `r${i + 2}` })

  const assets = clips.map((clip, i) => {
    const dur = clip.info?.duration ?? 0
    const hasAudio = clip.info?.audioCodec ? '1' : '0'
    return `    <asset id="r${i + 2}" name="${xmlEscape(clip.fileName)}" uid="${clip.id}"
      src="${fileUrl(clip.filePath)}"
      hasVideo="1" hasAudio="${hasAudio}"
      duration="${toRational(dur, fps)}" format="${formatId}"
      colorSpace="Rec.709"
      reelName="${xmlEscape(clip.reelName || clip.fileName.slice(0, 8))}">
      <media-rep kind="original-media" src="${fileUrl(clip.filePath)}"/>
      <metadata>
        <md key="com.blackmagicdesign.resolve.ReelName">${xmlEscape(clip.reelName)}</md>
        <md key="com.blackmagicdesign.resolve.Rating">${clip.rating}</md>
        <md key="com.blackmagicdesign.resolve.Flag">${clip.flag}</md>
        <md key="com.blackmagicdesign.resolve.Group">${xmlEscape(clip.group)}</md>
        <md key="com.blackmagicdesign.resolve.Notes">${xmlEscape(clip.notes)}</md>
      </metadata>
    </asset>`
  }).join('\n')

  const spineItems = timeline.map((tc) => {
    const src = clips.find((c) => c.id === tc.sourceClipId)
    if (!src) return ''
    const volDB = tc.volume === 1 ? '0dB' : `${((tc.volume - 1) * 20).toFixed(1)}dB`
    return `          <clip name="${xmlEscape(src.fileName)}" ref="${assetMap[tc.sourceClipId]}"
            offset="${toRational(tc.timelineStart, fps)}"
            duration="${toRational(tc.duration, fps)}"
            start="${toRational(tc.inPoint, fps)}"
            tcFormat="NDF">
            <adjust-volume amount="${volDB}"/>
            <metadata>
              <md key="com.blackmagicdesign.resolve.ReelName">${xmlEscape(src.reelName)}</md>
              <md key="com.blackmagicdesign.resolve.Rating">${src.rating}</md>
            </metadata>
          </clip>`
  }).filter(Boolean).join('\n')

  const selectItems = clips
    .filter((c) => c.inPointSet || c.outPointSet || c.flag === 'pick')
    .map((clip) => {
      const inPt = clip.inPointSet ? clip.inPoint : 0
      const outPt = clip.outPointSet ? clip.outPoint : (clip.info?.duration ?? 0)
      return `          <clip name="${xmlEscape(clip.fileName)}" ref="${assetMap[clip.id]}"
            offset="0s" duration="${toRational(outPt - inPt, fps)}" start="${toRational(inPt, fps)}">
            <note>${xmlEscape(clip.notes)}</note>
            <metadata><md key="com.blackmagicdesign.resolve.Flag">${clip.flag}</md></metadata>
          </clip>`
    }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- DaVinci Resolve XML — Import via File > Import Timeline > FCPXML -->
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="${formatId}" name="FFVideoFormat${height}p${fps}"
      frameDuration="${Math.round(100 / fps)}/100s"
      width="${width}" height="${height}"
      colorSpace="1-1-1 (Rec. 709)"/>
${assets}
  </resources>
  <library location="${fileUrl(settings.outputDir || '/')}">
    <event name="${xmlEscape(settings.name)} — ${xmlEscape(settings.couple)}">
      ${timeline.length ? `<project name="${xmlEscape(settings.name)} — Timeline">
        <sequence duration="${toRational(timeline.reduce((s, tc) => s + tc.duration, 0), fps)}"
          format="${formatId}" tcStart="0s" tcFormat="NDF"
          audioLayout="stereo" audioRate="48k">
          <spine>
${spineItems}
          </spine>
        </sequence>
      </project>` : ''}
      <project name="${xmlEscape(settings.name)} — Selects">
        <sequence duration="${toRational(clips.filter(c => c.flag === 'pick' || c.inPointSet || c.outPointSet).reduce((s, c) => {
          const inPt = c.inPointSet ? c.inPoint : 0
          const outPt = c.outPointSet ? c.outPoint : (c.info?.duration ?? 0)
          return s + (outPt - inPt)
        }, 0), fps)}"
          format="${formatId}" tcStart="0s" tcFormat="NDF"
          audioLayout="stereo" audioRate="48k">
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
// 5. EDL (CMX 3600)
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

  const source = timeline.length > 0
    ? timeline.map((tc) => ({
        reel: clipMap[tc.sourceClipId]?.reelName || clipMap[tc.sourceClipId]?.fileName.slice(0, 8).toUpperCase() || 'AX',
        name: clipMap[tc.sourceClipId]?.fileName || '',
        srcIn: tc.inPoint, srcOut: tc.outPoint,
        recIn: tc.timelineStart, recOut: tc.timelineStart + tc.duration,
      }))
    : clips
        .filter((c) => c.inPointSet || c.outPointSet || c.flag === 'pick')
        .reduce<{ reel: string; name: string; srcIn: number; srcOut: number; recIn: number; recOut: number }[]>((acc, c) => {
          const prev = acc[acc.length - 1]
          const recIn = prev ? prev.recOut : 0
          const inPt = c.inPointSet ? c.inPoint : 0
          const outPt = c.outPointSet ? c.outPoint : (c.info?.duration ?? 0)
          acc.push({ reel: c.reelName || 'AX', name: c.fileName, srcIn: inPt, srcOut: outPt, recIn, recOut: recIn + (outPt - inPt) })
          return acc
        }, [])

  source.forEach((item, idx) => {
    const num = String(idx + 1).padStart(3, '0')
    const reel = item.reel.slice(0, 8).padEnd(8, ' ')
    lines.push(`${num}  ${reel}  V  C  ${formatTimecode(item.srcIn, fps)} ${formatTimecode(item.srcOut, fps)} ${formatTimecode(item.recIn, fps)} ${formatTimecode(item.recOut, fps)}`)
    lines.push(`* FROM CLIP NAME: ${item.name}`)
    lines.push('')
  })

  return lines.join('\n')
}

// ──────────────────────────────────────────────
// 6. CSV Log
// ──────────────────────────────────────────────
export function generateCSV(clips: MediaClip[], fps: number): string {
  const header = 'Filename,Duration,In Point,Out Point,Rating,Flag,Color Label,Notes,Group,Reel,Codec,Resolution,FPS,Subclips,Markers'
  const rows = clips.map((c) => {
    const dur = c.info?.duration ?? 0
    const inPt  = c.inPointSet  ? formatTimecode(c.inPoint, fps)  : '00:00:00:00'
    const outPt = c.outPointSet ? formatTimecode(c.outPoint, fps) : formatTimecode(dur, fps)
    const res = c.info ? `${c.info.width}x${c.info.height}` : ''
    return [
      `"${c.fileName}"`,
      formatTimecode(dur, fps),
      inPt, outPt,
      c.rating, c.flag, c.colorLabel,
      `"${c.notes.replace(/"/g, '""')}"`,
      `"${c.group}"`,
      `"${c.reelName}"`,
      c.info?.codec ?? '', res, c.info?.fps ?? fps,
      c.subClips.length,
      c.markers.length,
    ].join(',')
  })
  return [header, ...rows].join('\n')
}
