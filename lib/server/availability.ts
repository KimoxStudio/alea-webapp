import type { GameTable, TableAvailability, TimeSlot } from '@/lib/types'
import type { Tables } from '@/lib/supabase/types'
import { serviceError } from '@/lib/server/service-error'

type ReservationRow = Tables<'reservations'>
type ReservedSlot = {
  start: string
  end: string
  surface?: 'top' | 'bottom'
  source?: 'reservation' | 'event'
  label?: string | null
}

export function resolveDate(date?: string | null): string {
  const today = new Date().toISOString().split('T')[0]
  if (!date || date.trim() === '') return today
  const trimmed = date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    serviceError('Date must be in YYYY-MM-DD format', 400)
  }
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) {
    serviceError('Invalid date value', 400)
  }
  return trimmed
}

export function normalizeTime(time: string) {
  return time.slice(0, 5)
}

export function generateDaySlots(reservedSlots: ReservedSlot[]): TimeSlot[] {
  return Array.from({ length: 24 }, (_, i) => {
    const time = `${String(i).padStart(2, '0')}:00`
    const nextHour = i + 1
    const nextTime = nextHour < 24 ? `${String(nextHour).padStart(2, '0')}:00` : '24:00'
    const reservation = reservedSlots.find((item) => item.start <= time && item.end >= time)
    return {
      startTime: time,
      endTime: nextTime,
      available: !reservation,
      source: reservation?.source,
      label: reservation?.label ?? null,
    }
  })
}

export function buildAvailability(
  table: GameTable,
  date: string,
  reservations: ReservationRow[],
  eventBlocks: Array<{ start: string; end: string; label?: string | null }> = [],
): TableAvailability {
  const reserved = reservations.map((reservation) => ({
    start: normalizeTime(reservation.start_time),
    end: normalizeTime(reservation.end_time),
    surface: reservation.surface ?? undefined,
    source: 'reservation' as const,
    label: null,
  }))
  const blockedByEvents = eventBlocks.map((block) => ({
    start: block.start,
    end: block.end,
    source: 'event' as const,
    label: block.label ?? null,
  }))
  const combinedReserved = [...reserved, ...blockedByEvents]

  const availability: TableAvailability = {
    tableId: table.id,
    date,
    slots: generateDaySlots(combinedReserved),
  }

  if (table.type === 'removable_top') {
    const topReserved = [
      ...reserved.filter((reservation) => reservation.surface == null || reservation.surface === 'top'),
      ...blockedByEvents,
    ]
    const bottomReserved = [
      ...reserved.filter((reservation) => reservation.surface == null || reservation.surface === 'bottom'),
      ...blockedByEvents,
    ]
    availability.top = generateDaySlots(topReserved)
    availability.bottom = generateDaySlots(bottomReserved)
    availability.conflicts = generateDaySlots(combinedReserved)
  }

  return availability
}
