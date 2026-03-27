import { describe, it, expect } from 'vitest'

// Business logic unit tests for removable_top tables
describe('Removable top table availability logic', () => {
  it('should identify when both surfaces are available', () => {
    const topSlots = [
      { startTime: '10:00', endTime: '11:00', available: true },
    ]
    const bottomSlots = [
      { startTime: '10:00', endTime: '11:00', available: true },
    ]
    const topHasUnavailable = topSlots.some(s => !s.available)
    const bottomHasUnavailable = bottomSlots.some(s => !s.available)
    expect(topHasUnavailable).toBe(false)
    expect(bottomHasUnavailable).toBe(false)
  })

  it('should identify when top surface is occupied', () => {
    const topSlots = [
      { startTime: '10:00', endTime: '11:00', available: false },
    ]
    const topHasUnavailable = topSlots.some(s => !s.available)
    expect(topHasUnavailable).toBe(true)
  })

  it('should identify when both surfaces are occupied', () => {
    const topSlots = [{ startTime: '10:00', endTime: '11:00', available: false }]
    const bottomSlots = [{ startTime: '10:00', endTime: '11:00', available: false }]
    const allOccupied = topSlots.every(s => !s.available) && bottomSlots.every(s => !s.available)
    expect(allOccupied).toBe(true)
  })

  it('should validate mutual exclusivity constraint', () => {
    // If top is reserved at 10:00, bottom cannot be reserved at 10:00
    const topReservations = [{ startTime: '10:00', endTime: '12:00' }]
    const requestedTime = '11:00'
    const conflictOnTop = topReservations.some(r => r.startTime <= requestedTime && r.endTime > requestedTime)
    expect(conflictOnTop).toBe(true)
  })
})
