import { describe, it, expect } from 'vitest'
import { formatDate, formatTime, generateTimeSlots } from '@/lib/utils'

describe('formatDate', () => {
  it('formats date string correctly', () => {
    const result = formatDate('2025-01-15', 'es-ES')
    expect(result).toContain('15')
    expect(result).toContain('01')
    expect(result).toContain('2025')
  })
})

describe('formatTime', () => {
  it('returns HH:mm format', () => {
    expect(formatTime('10:00:00')).toBe('10:00')
    expect(formatTime('09:30')).toBe('09:30')
  })
})

describe('generateTimeSlots', () => {
  it('generates slots from 09:00 to 22:00', () => {
    const slots = generateTimeSlots('09:00', '22:00', 60)
    expect(slots[0]).toBe('09:00')
    expect(slots[slots.length - 1]).toBe('21:00')
    expect(slots).toHaveLength(13)
  })

  it('generates 30-min slots', () => {
    const slots = generateTimeSlots('09:00', '10:00', 30)
    expect(slots).toEqual(['09:00', '09:30'])
  })
})
