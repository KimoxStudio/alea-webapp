import 'server-only'
import type { GameTable, TableAvailability, TimeSlot } from '@/lib/types'
import type { Tables } from '@/lib/supabase/types'
import { getCurrentClubDate, isValidDateOnlyString } from '@/lib/club-time'
import { serviceError } from '@/lib/server/service-error'

type ReservationRow = Tables<'reservations'>
type ReservedSlot = {
  start: string
  end: string
  surface?: 'top' | 'bottom'
  source?: 'reservation' | 'event'
  label?: string | null
}

const DAY_MINUTES = 24 * 60
const SLOT_INTERVAL_MINUTES = 30

function formatSlotMinutes(totalMinutes: number) {
  if (totalMinutes === DAY_MINUTES) return '24:00'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function resolveDate(date?: string | null): string {
  const today = getCurrentClubDate()
  if (!date || date.trim() === '') return today
  const trimmed = date.trim()
  if (!isValidDateOnlyString(trimmed)) {
    serviceError('Invalid date value', 400)
  }
  return trimmed
}

export function normalizeTime(time: string) {
  return time.slice(0, 5)
}

export function generateDaySlots(reservedSlots: ReservedSlot[]): TimeSlot[] {
  return Array.from({ length: DAY_MINUTES / SLOT_INTERVAL_MINUTES }, (_, i) => {
    const slotStartMinutes = i * SLOT_INTERVAL_MINUTES
    const slotEndMinutes = slotStartMinutes + SLOT_INTERVAL_MINUTES
    const slotStart = formatSlotMinutes(slotStartMinutes)
    const slotEnd = formatSlotMinutes(slotEndMinutes)
    const reservation = reservedSlots.find((item) => item.start < slotEnd && slotStart < item.end)
    return {
      startTime: slotStart,
      endTime: slotEnd,
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
