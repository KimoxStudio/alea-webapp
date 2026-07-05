'use client'

import { useTranslations } from 'next-intl'

interface EasterEggProps {
  open: boolean
  onClose: () => void
}

/** Modal easter egg — "natural 20". */
export function EasterEgg({ open, onClose }: EasterEggProps) {
  const t = useTranslations('home')
  if (!open) return null
  return (
    <div className="egg-backdrop" onClick={onClose}>
      <div className="egg-card" onClick={(e) => e.stopPropagation()}>
        <div className="egg-d20">
          <svg viewBox="0 0 100 100" width="160" height="160">
            <defs>
              <radialGradient id="d20g" cx="40%" cy="35%">
                <stop offset="0%" stopColor="#ffd980" />
                <stop offset="100%" stopColor="#7a1f1f" />
              </radialGradient>
            </defs>
            <polygon points="50,4 96,28 96,72 50,96 4,72 4,28" fill="url(#d20g)" stroke="#c8a25b" strokeWidth="2" />
            <polygon points="50,4 96,28 50,50" fill="rgba(255,255,255,0.08)" />
            <polygon points="96,28 96,72 50,50" fill="rgba(0,0,0,0.12)" />
            <polygon points="96,72 50,96 50,50" fill="rgba(0,0,0,0.22)" />
            <polygon points="50,96 4,72 50,50" fill="rgba(0,0,0,0.18)" />
            <polygon points="4,72 4,28 50,50" fill="rgba(255,255,255,0.06)" />
            <polygon points="4,28 50,4 50,50" fill="rgba(255,255,255,0.16)" />
            <text x="50" y="58" textAnchor="middle" fontFamily="Cormorant Garamond, serif" fontSize="22" fontWeight="700" fill="#1a1410">
              20
            </text>
          </svg>
        </div>
        <h3>{t('egg.title')}</h3>
        <p>{t('egg.body')}</p>
        <button onClick={onClose}>{t('egg.close')}</button>
      </div>
    </div>
  )
}
