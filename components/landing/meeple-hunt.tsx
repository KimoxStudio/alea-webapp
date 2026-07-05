'use client'

import { useEffect, useRef, useState } from 'react'

interface MeepleHuntProps {
  onCatch: () => void
  autoSpawnDelay?: [number, number]
}

interface MeepleState {
  x0: number
  y0: number
  x1: number
  y1: number
  dur: number
  t0: number
}

/**
 * Catchable meeple that wanders across the screen. Click/tap it to trigger the reward easter egg.
 */
export function MeepleHunt({ onCatch, autoSpawnDelay = [22000, 45000] }: MeepleHuntProps) {
  const [meeple, setMeeple] = useState<MeepleState | null>(null)
  const [caught, setCaught] = useState(false)

  useEffect(() => {
    if (caught) return
    let timer: ReturnType<typeof setTimeout>

    const edge = (s: number) => {
      const H = window.innerHeight
      const W = window.innerWidth
      const r = Math.random()
      switch (s) {
        case 0:
          return { x: -60, y: H * (0.2 + r * 0.6) }
        case 1:
          return { x: W + 60, y: H * (0.2 + r * 0.6) }
        case 2:
          return { x: W * (0.2 + r * 0.6), y: -60 }
        default:
          return { x: W * (0.2 + r * 0.6), y: H + 60 }
      }
    }

    const spawn = () => {
      const side = Math.floor(Math.random() * 4)
      const start = edge(side)
      const end = edge((side + 2) % 4)
      const dur = 14000 + Math.random() * 6000
      const t0 = Date.now()
      setMeeple({ x0: start.x, y0: start.y, x1: end.x, y1: end.y, dur, t0 })
      setTimeout(() => {
        setMeeple((m) => (m && Date.now() - m.t0 >= dur ? null : m))
        if (!caught) schedule()
      }, dur)
    }

    const schedule = () => {
      const delay = autoSpawnDelay[0] + Math.random() * (autoSpawnDelay[1] - autoSpawnDelay[0])
      timer = setTimeout(spawn, delay)
    }

    schedule()
    return () => clearTimeout(timer)
  }, [caught, autoSpawnDelay])

  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!meeple || caught) return
    let raf = 0
    const tick = () => {
      const t = Math.min(1, (Date.now() - meeple.t0) / meeple.dur)
      const x = meeple.x0 + (meeple.x1 - meeple.x0) * t
      const y = meeple.y0 + (meeple.y1 - meeple.y0) * t
      const bob = Math.sin(t * 10 * Math.PI) * 6
      const rot = Math.sin(t * 12 * Math.PI) * 8
      if (ref.current) ref.current.style.transform = `translate(${x}px, ${y + bob}px) rotate(${rot}deg)`
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [meeple, caught])

  const handleCatch = () => {
    if (caught) return
    setCaught(true)
    setMeeple(null)
    onCatch()
  }

  if (!meeple || caught) return null
  return (
    <button ref={ref} className="meeple-hunt" onClick={handleCatch} onTouchStart={handleCatch} aria-label="Catch the meeple">
      <svg viewBox="0 0 60 70" width="48" height="56" aria-hidden>
        <defs>
          <radialGradient id="mple-grad" cx="40%" cy="30%">
            <stop offset="0%" stopColor="#ffd980" />
            <stop offset="100%" stopColor="#a93232" />
          </radialGradient>
        </defs>
        <path
          d="M 30 4 C 38 4 42 10 39 16 C 49 18 54 26 54 36 L 54 56 C 54 60 50 64 46 64 L 40 64 L 40 54 L 36 54 L 32 64 L 28 64 L 24 54 L 20 54 L 20 64 L 14 64 C 10 64 6 60 6 56 L 6 36 C 6 26 11 18 21 16 C 18 10 22 4 30 4 Z"
          fill="url(#mple-grad)"
          stroke="#f4ead5"
          strokeWidth="1.5"
        />
      </svg>
      <span className="meeple-sparkle" aria-hidden>
        ✦
      </span>
    </button>
  )
}
