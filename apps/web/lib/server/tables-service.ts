import type { GameTable, TableAvailability, TimeSlot } from '@alea/types'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'
import { resolveDate } from '@/lib/server/availability'

type TableRow = Tables<'tables'>
type ReservationRow = Tables<'reservations'>

const TABLE_COLUMNS = 'id, room_id, name, type, qr_code, pos_x, pos_y'

function normalizeTime(time: string) {
  return time.slice(0, 5)
}

function toGameTable(row: TableRow): GameTable {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    type: row.type,
    qrCode: row.qr_code ?? '',
    position: row.pos_x == null || row.pos_y == null ? undefined : { x: row.pos_x, y: row.pos_y },
  }
}

function generateDaySlots(reservedSlots: Array<{ start: string; end: string }>): TimeSlot[] {
  return Array.from({ length: 13 }, (_, i) => {
    const hour = 9 + i
    const time = `${String(hour).padStart(2, '0')}:00`
    const nextTime = `${String(hour + 1).padStart(2, '0')}:00`
    const isReserved = reservedSlots.some((reservation) => reservation.start <= time && reservation.end > time)
    return { startTime: time, endTime: nextTime, available: !isReserved }
  })
}

function buildAvailability(table: GameTable, date: string, reservations: ReservationRow[]): TableAvailability {
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
    const topReserved = reserved.filter((reservation) => !reservation.surface || reservation.surface === 'top')
    const bottomReserved = reserved.filter((reservation) => reservation.surface === 'bottom')
    availability.top = generateDaySlots(topReserved)
    availability.bottom = generateDaySlots(bottomReserved)
    availability.conflicts = generateDaySlots(reserved)
  }

  return availability
}

export async function getTableAvailability(tableId: string, date?: string | null) {
  const supabase = await createSupabaseServerClient()
  const tableResult = await supabase
    .from('tables')
    .select(TABLE_COLUMNS)
    .eq('id', tableId)
    .maybeSingle()
  const table = tableResult.data as TableRow | null
  const tableError = tableResult.error

  if (tableError) {
    serviceError('Internal server error', 500)
  }
  if (!table) {
    serviceError('Table not found', 404)
  }

  const effectiveDate = resolveDate(date)
  const admin = createSupabaseServerAdminClient()
  const reservationsResult = await admin
    .from('reservations')
    .select('id, table_id, date, start_time, end_time, status, surface, user_id, created_at')
    .eq('table_id', tableId)
    .eq('date', effectiveDate)
    .eq('status', 'active')
  const reservations = (reservationsResult.data ?? []) as ReservationRow[]
  const reservationsError = reservationsResult.error

  if (reservationsError) {
    serviceError('Internal server error', 500)
  }

  return buildAvailability(toGameTable(table!), effectiveDate, reservations)
}
