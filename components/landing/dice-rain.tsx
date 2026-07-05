'use client'

import { useEffect, useRef } from 'react'

interface DiceRainProps {
  active: boolean
}

interface FallingDie {
  x: number
  y: number
  r: number
  vy: number
  rot: number
  vr: number
  face: number
}

const PIP_MAP: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
}

/** Canvas dice-rain effect — plays alongside the "natural 20" easter egg. */
export function DiceRain({ active }: DiceRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const cnv = canvasRef.current
    if (!cnv) return
    const ctx = cnv.getContext('2d')
    if (!ctx) return
    cnv.width = window.innerWidth
    cnv.height = window.innerHeight
    const dice: FallingDie[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * cnv.width,
      y: -Math.random() * cnv.height,
      r: 18 + Math.random() * 22,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.1,
      face: 1 + Math.floor(Math.random() * 6),
    }))
    let raf = 0
    let frames = 0
    const draw = () => {
      ctx.clearRect(0, 0, cnv.width, cnv.height)
      dice.forEach((d) => {
        d.y += d.vy
        d.rot += d.vr
        if (d.y > cnv.height + 50) d.y = -50
        ctx.save()
        ctx.translate(d.x, d.y)
        ctx.rotate(d.rot)
        ctx.fillStyle = '#f4ead5'
        ctx.strokeStyle = '#1a1410'
        ctx.lineWidth = 2
        const s = d.r
        ctx.beginPath()
        ctx.roundRect(-s, -s, s * 2, s * 2, 6)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#1a1410'
        PIP_MAP[d.face].forEach(([px, py]) => {
          ctx.beginPath()
          ctx.arc(-s + px * 2 * s, -s + py * 2 * s, s * 0.12, 0, Math.PI * 2)
          ctx.fill()
        })
        ctx.restore()
      })
      frames++
      if (frames < 400) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [active])

  if (!active) return null
  return <canvas ref={canvasRef} className="dice-rain" />
}
