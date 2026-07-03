'use client'

import { useEffect, useRef } from 'react'

/**
 * Custom "pawn" cursor (dot + trailing ring), desktop only — CSS already
 * disables this and restores the native cursor on touch/coarse-pointer
 * devices (see .modern-root rules in landing.css).
 */
export function CustomCursor({ color = '#c8a25b' }: { color?: string }) {
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

  return (
    <>
      <div ref={ringRef} className="cursor-ring" style={{ borderColor: color }} aria-hidden="true" />
      <div ref={dotRef} className="cursor-dot" aria-hidden="true">
        <svg width="22" height="28" viewBox="0 0 100 120" aria-hidden="true">
          <circle cx="50" cy="24" r="22" fill={color} />
          <path d="M28 50 Q50 60 72 50 L78 70 Q50 80 22 70Z" fill={color} />
          <path d="M16 84 L84 84 L92 116 L8 116Z" fill={color} />
        </svg>
      </div>
    </>
  )
}
