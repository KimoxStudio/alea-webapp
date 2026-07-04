'use client'

import { useEffect } from 'react'

interface ShakeOpts {
  threshold?: number
}

/** Detects a device shake gesture (mobile) and triggers a callback — used for the landing easter egg. */
export function useShake(onTrigger: () => void, { threshold = 22 }: ShakeOpts = {}) {
  useEffect(() => {
    let last = { x: 0, y: 0, z: 0, t: 0 }
    let count = 0
    let resetTimer: ReturnType<typeof setTimeout>

    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity || e.acceleration
      if (!acc) return
      const now = Date.now()
      if (now - last.t < 80) return
      const dx = Math.abs((acc.x || 0) - last.x)
      const dy = Math.abs((acc.y || 0) - last.y)
      const dz = Math.abs((acc.z || 0) - last.z)
      if (dx + dy + dz > threshold) {
        count++
        clearTimeout(resetTimer)
        resetTimer = setTimeout(() => (count = 0), 900)
        if (count >= 3) {
          onTrigger()
          count = 0
        }
      }
      last = { x: acc.x || 0, y: acc.y || 0, z: acc.z || 0, t: now }
    }

    const attach = () => window.addEventListener('devicemotion', handler)

    // iOS requires explicit permission; request it on the user's first touch.
    const DME = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<string>
    }
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DME.requestPermission === 'function') {
      const ask = async () => {
        try {
          const r = await DME.requestPermission!()
          if (r === 'granted') attach()
        } catch {
          // permission denied or unsupported — ignore
        }
        window.removeEventListener('touchend', ask)
      }
      window.addEventListener('touchend', ask, { once: true })
    } else if (typeof DeviceMotionEvent !== 'undefined') {
      attach()
    }

    return () => {
      window.removeEventListener('devicemotion', handler)
      clearTimeout(resetTimer)
    }
  }, [onTrigger, threshold])
}
