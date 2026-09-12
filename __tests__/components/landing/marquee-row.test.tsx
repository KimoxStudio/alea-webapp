import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MarqueeRow } from '@/components/landing/marquee-row'

// #407 — the CSS `prefers-reduced-motion` rule in app/globals.css cannot
// touch this component's own requestAnimationFrame auto-scroll loop or its
// scrollBy({behavior:'smooth'}) call (an explicit `behavior` option
// overrides the CSS `scroll-behavior` property per the CSSOM-View spec).
// Both have to check the media feature themselves — these tests prove they
// do, by mocking `window.matchMedia` (jsdom doesn't implement it) rather
// than relying on the CSS this component doesn't use for its own motion.

function mockMatchMedia(matches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  const mql = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql))
  return mql
}

function renderRow() {
  return render(
    <MarqueeRow ariaLabel="Carousel" prevLabel="Previous" nextLabel="Next">
      {[<span key="1">Item 1</span>, <span key="2">Item 2</span>]}
    </MarqueeRow>,
  )
}

describe('MarqueeRow — honours prefers-reduced-motion (#407)', () => {
  beforeEach(() => {
    // jsdom does not implement Element.scrollBy.
    Element.prototype.scrollBy = vi.fn()
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('never starts the auto-scroll requestAnimationFrame loop when the user prefers reduced motion', () => {
    mockMatchMedia(true)
    renderRow()

    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('starts the auto-scroll requestAnimationFrame loop when reduced motion is not requested', () => {
    mockMatchMedia(false)
    renderRow()

    expect(window.requestAnimationFrame).toHaveBeenCalled()
  })

  it('scrolls the prev/next buttons with behavior "auto" instead of "smooth" when reduced motion is requested', async () => {
    mockMatchMedia(true)
    const user = userEvent.setup()
    renderRow()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(Element.prototype.scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'auto' }),
    )
  })

  it('scrolls the prev/next buttons with behavior "smooth" when reduced motion is not requested', async () => {
    mockMatchMedia(false)
    const user = userEvent.setup()
    renderRow()

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(Element.prototype.scrollBy).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' }),
    )
  })
})
