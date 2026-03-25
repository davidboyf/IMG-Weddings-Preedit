import React, { useEffect, useRef } from 'react'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  separator?: never
}

export interface ContextMenuSeparator {
  separator: true
  label?: never
  icon?: never
  onClick?: never
  danger?: never
  disabled?: never
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator

interface Props {
  x: number
  y: number
  items: ContextMenuEntry[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handleClick)
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('mousedown', handleClick)
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Clamp to viewport
  const [ax, ay] = React.useMemo(() => {
    const w = 200
    const h = items.length * 32
    const cx = x + w > window.innerWidth  ? x - w : x
    const cy = y + h > window.innerHeight ? y - h : y
    return [cx, cy]
  }, [x, y, items.length])

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] py-1 rounded-xl overflow-hidden animate-scale-in"
      style={{
        left: ax,
        top: ay,
        minWidth: 200,
        background: 'rgba(18,18,32,0.97)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        backdropFilter: 'blur(40px)',
      }}
    >
      {items.map((item, i) => {
        if ('separator' in item && item.separator) {
          return <div key={i} className="my-1 mx-3 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
        }
        const mi = item as ContextMenuItem
        return (
          <button
            key={i}
            onClick={() => { if (!mi.disabled) { mi.onClick(); onClose() } }}
            disabled={mi.disabled}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors ${
              mi.disabled
                ? 'text-white/25 cursor-not-allowed'
                : mi.danger
                ? 'text-red-400 hover:bg-red-400/10'
                : 'text-white/80 hover:bg-white/[0.07]'
            }`}
          >
            {mi.icon && <span className="w-4 flex items-center justify-center opacity-60 flex-shrink-0">{mi.icon}</span>}
            {mi.label}
          </button>
        )
      })}
    </div>
  )
}
