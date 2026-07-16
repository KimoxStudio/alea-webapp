// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

describe('club-time helpers', () => {
  it('returns today in the configured club timezone instead of UTC date rollover', async () => {
    vi.resetModules()
    const { getCurrentClubDate } = await import('@/lib/club-time')
    const now = new Date('2026-04-15T23:30:00.000Z')

    expect(getCurrentClubDate(now, 'Atlantic/Canary')).toBe('2026-04-16')
    expect(getCurrentClubDate(now, 'America/New_York')).toBe('2026-04-15')
  })

  it('validates date-only strings without relying on Date parsing quirks', async () => {
    vi.resetModules()
    const { isValidDateOnlyString } = await import('@/lib/club-time')
    expect(isValidDateOnlyString('2026-02-28')).toBe(true)
    expect(isValidDateOnlyString('2026-02-30')).toBe(false)
    expect(isValidDateOnlyString('2026/02/28')).toBe(false)
  })

  it('converts club-local civil time into the matching UTC instant', async () => {
    vi.resetModules()
    const { zonedDateTimeToUtc } = await import('@/lib/club-time')
    expect(zonedDateTimeToUtc('2026-06-15', '16:00', 'Atlantic/Canary').toISOString()).toBe('2026-06-15T15:00:00.000Z')
    expect(zonedDateTimeToUtc('2026-01-15', '16:00', 'Atlantic/Canary').toISOString()).toBe('2026-01-15T16:00:00.000Z')
  })

  it('treats 24:00 as next-day midnight', async () => {
    vi.resetModules()
    const { zonedDateTimeToUtc } = await import('@/lib/club-time')
    expect(zonedDateTimeToUtc('2026-06-15', '24:00', 'Atlantic/Canary').toISOString()).toBe('2026-06-15T23:00:00.000Z')
    expect(zonedDateTimeToUtc('2026-01-15', '24:00', 'Atlantic/Canary').toISOString()).toBe('2026-01-16T00:00:00.000Z')
  })
})
