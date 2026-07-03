'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface MarqueeRowProps {
  children: ReactNode[]
  speedPxSec?: number
  ariaLabel: string
  prevLabel: string
  nextLabel: string
}

interface DragState {
  active: boolean
  startX: number
  startScroll: number
  moved: number
  isTouch: boolean
  dragging: boolean
}

/**
 * Generic horizontal carousel ported from the design source's MarqueeRow:
 * auto-scroll + mouse-drag + native touch scroll + keyboard arrows +
 * prev/next buttons. Items are duplicated for a seamless infinite loop.
 */
export function MarqueeRow({ children, speedPxSec = 30, ariaLabel, prevLabel, nextLabel }: MarqueeRowProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  const drag = useRef<DragState>({ active: false, startX: 0, startScroll: 0, moved: 0, isTouch: false, dragging: false })
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Auto-scroll loop.
  useEffect(() => {
    let raf: number
    let last = performance.now()
    const tick = (now: number) => {
      const dt = now - last
      last = now
      const el = trackRef.current
      if (el && !paused) {
        el.scrollLeft += (speedPxSec * dt) / 1000
        const half = el.scrollWidth / 2
        if (el.scrollLeft >= half) el.scrollLeft -= half
        if (el.scrollLeft < 0) el.scrollLeft += half
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [paused, speedPxSec])

  const wrapSafe = (el: HTMLDivElement) => {
    const half = el.scrollWidth / 2
    if (el.scrollLeft >= half) el.scrollLeft -= half
    else if (el.scrollLeft < 0) el.scrollLeft += half
  }

  const scrollByCards = (dir: 1 | -1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector('.alea-marquee-item')
    const step = card ? card.getBoundingClientRect().width + 18 : el.clientWidth * 0.8
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
    setPaused(true)
    clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => {
      wrapSafe(el)
      setPaused(false)
    }, 700)
  }

  const onPointerMoveGlobal = (e: PointerEvent) => {
    const s = drag.current
    const el = trackRef.current
    if (!s.active || !el || s.isTouch) return
    const dx = e.clientX - s.startX
    s.moved = Math.abs(dx)
    if (!s.dragging && s.moved > 6) {
      s.dragging = true
      el.style.cursor = 'grabbing'
      el.style.userSelect = 'none'
    }
    if (s.dragging) {
      el.scrollLeft = s.startScroll - dx
      e.preventDefault()
    }
  }

  const onPointerUpGlobal = () => {
    const el = trackRef.current
    const s = drag.current
    window.removeEventListener('pointermove', onPointerMoveGlobal)
    window.removeEventListener('pointerup', onPointerUpGlobal)
    window.removeEventListener('pointercancel', onPointerUpGlobal)
    if (el) {
      el.style.cursor = ''
      el.style.userSelect = ''
    }
    if (s.dragging) {
      setTimeout(() => {
        s.dragging = false
        s.moved = 0
      }, 60)
    } else {
      s.dragging = false
      s.moved = 0
    }
    s.active = false
    setTimeout(() => setPaused(false), 600)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current
    if (!el) return
    if (e.pointerType === 'touch') {
      drag.current = { active: false, startX: 0, startScroll: 0, moved: 0, isTouch: true, dragging: false }
      setPaused(true)
      return
    }
    drag.current = {
      active: true,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      moved: 0,
      isTouch: false,
      dragging: false,
    }
    setPaused(true)
    window.addEventListener('pointermove', onPointerMoveGlobal)
    window.addEventListener('pointerup', onPointerUpGlobal)
    window.addEventListener('pointercancel', onPointerUpGlobal)
  }

  const onTouchEnd = () => setTimeout(() => setPaused(false), 800)

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      scrollByCards(-1)
      e.preventDefault()
    }
    if (e.key === 'ArrowRight') {
      scrollByCards(1)
      e.preventDefault()
    }
  }

  const items = children

  return (
    <div className="alea-marquee-wrap" role="region" aria-label={ariaLabel} aria-roledescription="carousel">
      <button type="button" className="alea-marquee-nav alea-marquee-nav-prev" onClick={() => scrollByCards(-1)} aria-label={prevLabel}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M15 4 L 7 12 L 15 20" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div
        ref={trackRef}
        className="alea-marquee"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={onTouchEnd}
        onKeyDown={onKeyDown}
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="alea-marquee-track">
          {items.map((child, i) => (
            <div
              key={`a-${i}`}
              className="alea-marquee-item"
              onClickCapture={(e) => {
                if (drag.current.dragging) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
            >
              {child}
            </div>
          ))}
          {items.map((child, i) => (
            <div
              key={`b-${i}`}
              className="alea-marquee-item"
              aria-hidden="true"
              onClickCapture={(e) => {
                if (drag.current.dragging) {
                  e.preventDefault()
                  e.stopPropagation()
                }
              }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>
      <button type="button" className="alea-marquee-nav alea-marquee-nav-next" onClick={() => scrollByCards(1)} aria-label={nextLabel}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M9 4 L 17 12 L 9 20" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
