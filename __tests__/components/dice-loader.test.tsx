import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DiceLoader } from '@/components/ui/dice-loader'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('DiceLoader', () => {
  it('renders with role="status"', () => {
    render(<DiceLoader />)
    expect(screen.getByRole('status')).toBeDefined()
  })

  it('uses default aria-label from translations', () => {
    render(<DiceLoader />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-label')).toBe('loading')
  })

  it('uses custom label prop when provided', () => {
    render(<DiceLoader label="Please wait" />)
    const el = screen.getByRole('status')
    expect(el.getAttribute('aria-label')).toBe('Please wait')
  })

  it('renders SVG element inside', () => {
    const { container } = render(<DiceLoader size="md" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })
})
