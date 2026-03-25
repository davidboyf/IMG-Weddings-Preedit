import React from 'react'
import { X } from 'lucide-react'

interface Props {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'Playback',
    shortcuts: [
      ['Space / K', 'Play / Pause'],
      ['J', 'Rewind (hold = faster)'],
      ['L', 'Fast forward (hold = faster)'],
      ['←', 'Previous frame'],
      ['→', 'Next frame'],
      ['Shift+←/→', 'Jump 1 second'],
      ['Home', 'Jump to In point'],
      ['End', 'Jump to Out point'],
    ],
  },
  {
    title: 'In / Out Points',
    shortcuts: [
      ['I', 'Set In point'],
      ['O', 'Set Out point'],
      ['X', 'Clear In & Out'],
      ['Shift+I', 'Clear In point'],
      ['Shift+O', 'Clear Out point'],
    ],
  },
  {
    title: 'Clips',
    shortcuts: [
      ['E', 'Add clip to timeline'],
      ['M', 'Add marker'],
      ['P', 'Flag as Pick'],
      ['U', 'Unflag (clear flag)'],
      ['Delete / Backspace', 'Remove from library'],
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      ['Click', 'Select clip'],
      ['⌘+Click', 'Toggle multi-select'],
      ['Shift+Click', 'Select range'],
      ['⌘+A', 'Select all'],
      ['Escape', 'Clear selection'],
    ],
  },
  {
    title: 'File',
    shortcuts: [
      ['⌘+I', 'Import files'],
      ['⌘+⇧+I', 'Import folder'],
      ['⌘+S', 'Save project'],
      ['⌘+O', 'Open project'],
      ['⌘+E', 'Export XML'],
      ['⌘+⇧+E', 'Export clips'],
    ],
  },
  {
    title: 'Interface',
    shortcuts: [
      ['?', 'Show this overlay'],
      ['⌘+F', 'Full-screen player'],
      ['⌘+Z / ⌘+⇧+Z', 'Undo / Redo'],
      ['⌘+,', 'Project settings'],
    ],
  },
]

export default function KeyboardShortcutsOverlay({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl overflow-hidden animate-scale-in flex flex-col"
        style={{
          background: 'rgba(13,13,24,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          backdropFilter: 'blur(40px)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-white/90">Keyboard Shortcuts</h2>
            <p className="text-[11px] text-white/35 mt-0.5">Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 text-[10px]">?</kbd> anytime to show this</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts grid */}
        <div className="overflow-y-auto p-6 grid grid-cols-2 gap-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[11px] font-semibold text-[#e4bc72] uppercase tracking-wider mb-2">{section.title}</p>
              <div className="space-y-1">
                {section.shortcuts.map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span className="text-[12px] text-white/55 flex-1">{desc}</span>
                    <kbd className="px-2 py-0.5 rounded-md text-[11px] font-mono text-white/70 flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
