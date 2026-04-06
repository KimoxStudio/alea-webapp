import type { GameTable, TableAvailability, TimeSlot } from '@/lib/types'
import type { Tables } from '@/lib/supabase/types'
import { serviceError } from '@/lib/server/service-error'

type ReservationRow = Tables<'reservations'>

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

export function generateDaySlots(reservedSlots: Array<{ start: string; end: string }>): TimeSlot[] {
  return Array.from({ length: 13 }, (_, i) => {
    const hour = 9 + i
    const time = `${String(hour).padStart(2, '0')}:00`
    const nextTime = `${String(hour + 1).padStart(2, '0')}:00`
    const isReserved = reservedSlots.some((reservation) => reservation.start <= time && reservation.end > time)
    return { startTime: time, endTime: nextTime, available: !isReserved }
  })
}

export function buildAvailability(table: GameTable, date: string, reservations: ReservationRow[]): TableAvailability {
  const reserved = reservations.map((reservation) => ({
    start: normalizeTime(reservation.start_time),
    end: normalizeTime(reservation.end_time),
    surface: reservation.surface ?? undefined,
  }))

  const availability: TableAvailability = {
    tableId: table.id,
    date,
    slots: generateDaySlots(reserved),
  }

  if (table.type === 'removable_top') {
    const topReserved = reserved.filter((reservation) => reservation.surface === 'top')
    const bottomReserved = reserved.filter((reservation) => reservation.surface === 'bottom')
    availability.top = generateDaySlots(topReserved)
    availability.bottom = generateDaySlots(bottomReserved)
    availability.conflicts = generateDaySlots(reserved)
  }

  return availability
}
