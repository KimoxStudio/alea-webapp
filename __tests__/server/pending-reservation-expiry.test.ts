// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  getPendingCheckInDeadline,
  isPendingReservationExpired,
} from '@/lib/server/reservations/pending-reservation-expiry'

describe('pending reservation expiry', () => {
  const longSlot = {
    date: '2026-06-19',
    start_time: '16:00:00',
    end_time: '18:00:00',
  }

  it('anchors the deadline to start + 60 minutes for long slots', () => {
    expect(getPendingCheckInDeadline(longSlot).toISOString()).toBe('2026-06-19T15:00:00.000Z')
  })

  it('caps the deadline at the reservation end for short slots', () => {
    expect(getPendingCheckInDeadline({ ...longSlot, end_time: '16:30:00' }).toISOString())
      .toBe('2026-06-19T14:30:00.000Z')
  })

  it('keeps the reservation valid at the exact deadline and expires it one millisecond later', () => {
    expect(isPendingReservationExpired(longSlot, new Date('2026-06-19T15:00:00.000Z'))).toBe(false)
    expect(isPendingReservationExpired(longSlot, new Date('2026-06-19T15:00:00.001Z'))).toBe(true)
  })
})
