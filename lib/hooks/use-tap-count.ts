'use client'

import { useEffect } from 'react'

/** Counts consecutive clicks/taps on a selector within a time window (mobile + desktop) — used for the landing easter egg. */
export function useTapCount(target: string, count: number, windowMs: number, onTrigger: () => void) {
  useEffect(() => {
    let n = 0
    let timer: ReturnType<typeof setTimeout>

    const handler = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest(target)
      if (!el) return
      n++
      clearTimeout(timer)
      timer = setTimeout(() => (n = 0), windowMs)
      if (n >= count) {
        onTrigger()
        n = 0
      }
    }

    document.addEventListener('click', handler)
    return () => {
      document.removeEventListener('click', handler)
      clearTimeout(timer)
    }
  }, [target, count, windowMs, onTrigger])
}
