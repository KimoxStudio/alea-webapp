'use client'

import { useEffect, useRef } from 'react'

type CustomCursorVariant = 'die' | 'meeple' | 'pawn'

interface CustomCursorProps {
  variant?: CustomCursorVariant
  color?: string
}

/**
 * Custom cursor (icon dot + trailing ring), desktop only — CSS already
 * disables this and restores the native cursor on touch/coarse-pointer
 * devices (see .modern-root rules in landing.css).
 */
export function CustomCursor({ variant = 'die', color = '#e6c281' }: CustomCursorProps) {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let x = 0
    let y = 0
    let rx = 0
    let ry = 0
    let raf: number

    const move = (e: MouseEvent) => {
      x = e.clientX
      y = e.clientY
      if (dotRef.current) {
        dotRef.current.style.left = `${x}px`
        dotRef.current.style.top = `${y}px`
      }
    }

    const loop = () => {
      rx += (x - rx) * 0.16
      ry += (y - ry) * 0.16
      if (ringRef.current) {
        ringRef.current.style.left = `${rx}px`
        ringRef.current.style.top = `${ry}px`
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', move)
    raf = requestAnimationFrame(loop)
    return () => {
      window.removeEventListener('mousemove', move)
      cancelAnimationFrame(raf)
    }
  }, [])

  const icon =
    variant === 'die' ? (
      <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true">
        <rect x="6" y="6" width="88" height="88" rx="16" fill={color} />
        <circle cx="30" cy="30" r="8" fill="#1a1410" />
        <circle cx="70" cy="70" r="8" fill="#1a1410" />
        <circle cx="50" cy="50" r="8" fill="#1a1410" />
      </svg>
    ) : variant === 'meeple' ? (
      <svg width="22" height="28" viewBox="0 0 100 120" aria-hidden="true">
        <path
          d="M50 0 C68 0 76 14 70 28 C88 30 100 42 100 60 L100 120 L0 120 L0 60 C0 42 12 30 30 28 C24 14 32 0 50 0Z"
          fill={color}
        />
      </svg>
    ) : (
      <svg width="22" height="28" viewBox="0 0 100 120" aria-hidden="true">
        <circle cx="50" cy="24" r="22" fill={color} />
        <path d="M28 50 Q50 60 72 50 L78 70 Q50 80 22 70Z" fill={color} />
        <path d="M16 84 L84 84 L92 116 L8 116Z" fill={color} />
      </svg>
    )

  return (
    <>
      <div ref={ringRef} className="cursor-ring" style={{ borderColor: color }} aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot" aria-hidden="true">
        {icon}
      </div>
    </>
  )
}
