import type { GameTable } from '@alea/types'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import { resolveDate, buildAvailability } from '@/lib/server/availability'
import type { Tables } from '@/lib/supabase/types'

type TableRow = Tables<'tables'>
type ReservationRow = Tables<'reservations'>

const TABLE_COLUMNS = 'id, room_id, name, type, qr_code, pos_x, pos_y'

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
