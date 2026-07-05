'use client'

import { useRef, useState } from 'react'
import type { LibraryGame } from '@/lib/types'

const PALETTES: [string, string][] = [
  ['#7a1f1f', '#d97757'],
  ['#1d4f8b', '#5fb3d4'],
  ['#3d5a3d', '#9bc275'],
  ['#5a2d6f', '#c89bd4'],
  ['#c8a25b', '#e6c281'],
  ['#a93232', '#f1c40f'],
  ['#2d4a5a', '#5fb3d4'],
  ['#6b3a18', '#c8a25b'],
]

interface GameCardProps {
  game: LibraryGame
  locale: string
  idx: number
  playersLabel: string
  timeLabel: string
  weightLabel: string
}

export function GameCard({ game, locale, idx, playersLabel, timeLabel, weightLabel }: GameCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0, p: 0 })
  const [c1, c2] = PALETTES[idx % PALETTES.length]!
  const category = locale === 'en' ? game.categoryEn : game.categoryEs

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: -py * 18, y: px * 22, p: 1 })
  }

  return (
    <div
      ref={ref}
      className="mod-game"
      onMouseMove={onMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0, p: 0 })}
      style={{ transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
    >
      <div className="mod-game-cover" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
        <div
          className="mod-game-shine"
          style={{ opacity: tilt.p, transform: `translate(${tilt.y * 4}px, ${-tilt.x * 4}px)` }}
        />
        <span className="mod-game-title-big">{game.title.split(':')[0]}</span>
        <span className="mod-game-cat">{category}</span>
      </div>
      <div className="mod-game-body">
        <h4>{game.title}</h4>
        <div className="mod-game-meta">
          <span>
            {playersLabel}: {game.players}
          </span>
          <span>·</span>
          <span>
            {timeLabel}: {game.playTime}
          </span>
          <span>·</span>
          <span>
            {weightLabel}: {game.weight}/5
          </span>
        </div>
      </div>
    </div>
  )
}
