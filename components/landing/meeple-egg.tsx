'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

interface MeepleEggProps {
  open: boolean
  onClose: () => void
}

const MEEPLE_CODE = 'MEEPLE26'

/** Reward modal shown after catching the wandering meeple. */
export function MeepleEgg({ open, onClose }: MeepleEggProps) {
  const t = useTranslations('home')
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MEEPLE_CODE)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <div className="meeple-backdrop" onClick={onClose}>
      <div className="meeple-card" onClick={(e) => e.stopPropagation()}>
        <svg viewBox="0 0 60 70" width="120" height="140" className="meeple-card-art">
          <defs>
            <radialGradient id="mple-grad-big" cx="40%" cy="30%">
              <stop offset="0%" stopColor="#ffd980" />
              <stop offset="100%" stopColor="#a93232" />
            </radialGradient>
          </defs>
          <path
            d="M 30 4 C 38 4 42 10 39 16 C 49 18 54 26 54 36 L 54 56 C 54 60 50 64 46 64 L 40 64 L 40 54 L 36 54 L 32 64 L 28 64 L 24 54 L 20 54 L 20 64 L 14 64 C 10 64 6 60 6 56 L 6 36 C 6 26 11 18 21 16 C 18 10 22 4 30 4 Z"
            fill="url(#mple-grad-big)"
            stroke="#f4ead5"
            strokeWidth="1.5"
          />
        </svg>
        <h3>{t('meeple.title')}</h3>
        <p>{t('meeple.body')}</p>
        <div className="meeple-code">
          <span>{MEEPLE_CODE}</span>
          <button onClick={copy}>{copied ? t('meeple.copied') : t('meeple.copy')}</button>
        </div>
        <button className="meeple-close" onClick={onClose}>
          {t('meeple.close')}
        </button>
      </div>
    </div>
  )
}
