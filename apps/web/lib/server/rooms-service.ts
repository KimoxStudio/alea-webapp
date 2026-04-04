import type { GameTable, Room, TableAvailability } from '@alea/types'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import { resolveDate, buildAvailability } from '@/lib/server/availability'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

type RoomRow = Tables<'rooms'>
type TableRow = Tables<'tables'>
type ReservationRow = Tables<'reservations'>
type RoomsTableClient = {
  select: (columns: string) => {
    order: (column: string, options: { ascending: boolean }) => Promise<{ data: RoomRow[] | null; error: unknown }>
  }
  insert: (values: TablesInsert<'rooms'>) => {
    select: (columns: string) => {
      maybeSingle: () => Promise<{ data: RoomRow | null; error: unknown }>
    }
  }
  update: (values: TablesUpdate<'rooms'>) => {
    eq: (column: 'id', value: string) => {
      select: (columns: string) => {
        maybeSingle: () => Promise<{ data: RoomRow | null; error: unknown }>
      }
    }
  }
}
type TablesByRoomClient = {
  select: (columns: string) => {
    eq: (column: 'room_id', value: string) => {
      order: (column: string, options: { ascending: boolean }) => Promise<{ data: TableRow[] | null; error: unknown }>
    }
  }
}
type ReservationsByTableClient = {
  select: (columns: string) => {
    eq: (column: 'date', value: string) => {
      eq: (column: 'status', value: 'active') => {
        in: (column: 'table_id', values: string[]) => Promise<{ data: ReservationRow[] | null; error: unknown }>
      }
    }
  }
}

const ROOM_COLUMNS = 'id, name, table_count, description'
const TABLE_COLUMNS = 'id, room_id, name, type, qr_code, pos_x, pos_y'

function toRoom(row: RoomRow): Room {
  return {
    id: row.id,
    name: row.name,
    tableCount: row.table_count,
    description: row.description ?? undefined,
  }
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

async function listTablesByRoom(roomId: string) {
  const supabase = await createSupabaseServerClient()
  const tables = supabase.from('tables') as unknown as TablesByRoomClient
  const { data, error } = await tables
    .select(TABLE_COLUMNS)
    .eq('room_id', roomId)
    .order('name', { ascending: true })

  if (error) {
    serviceError('Internal server error', 500)
  }

  return ((data ?? []) as TableRow[]).map(toGameTable)
}

export async function listAllRooms() {
  const supabase = await createSupabaseServerClient()
  const rooms = supabase.from('rooms') as unknown as RoomsTableClient
  const { data, error } = await rooms
    .select(ROOM_COLUMNS)
    .order('created_at', { ascending: true })

  if (error) {
    serviceError('Internal server error', 500)
  }

  return ((data ?? []) as RoomRow[]).map(toRoom)
}

export async function createRoomEntry(body: { name?: unknown; tableCount?: unknown; description?: unknown }) {
  const name = String(body.name ?? '').trim()
  if (!name) {
    serviceError('Room name is required', 400)
  }

  const rawCount = body.tableCount ?? 0
  const tableCount = Number(rawCount)
  if (!Number.isFinite(tableCount) || tableCount < 0 || !Number.isInteger(tableCount)) {
    throw serviceError('tableCount must be a non-negative integer', 400)
  }

  const supabase = await createSupabaseServerClient()
  const insert: TablesInsert<'rooms'> = {
    name,
    table_count: tableCount,
    description: body.description ? String(body.description) : null,
  }
  const rooms = supabase.from('rooms') as unknown as RoomsTableClient
  const { data, error } = await rooms
    .insert(insert)
    .select(ROOM_COLUMNS)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('Internal server error', 500)
  }

  return toRoom(data as RoomRow)
}

export async function updateRoom(id: string, body: { name?: unknown; description?: unknown; tableCount?: unknown }) {
  if (body.tableCount !== undefined) {
    serviceError('Updating tableCount is not supported', 400)
  }

  const supabase = await createSupabaseServerClient()
  const updates: TablesUpdate<'rooms'> = {
    name: body.name ? String(body.name) : undefined,
    description:
      body.description === undefined
        ? undefined
        : body.description === null
          ? null
          : String(body.description),
  }
  const rooms = supabase.from('rooms') as unknown as RoomsTableClient
  const { data, error } = await rooms
    .update(updates)
    .eq('id', id)
    .select(ROOM_COLUMNS)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('Room not found', 404)
  }

  return toRoom(data as RoomRow)
}

export async function listRoomTables(roomId: string) {
  return listTablesByRoom(roomId)
}

export async function getRoomTablesAvailability(roomId: string, date?: string | null) {
  const effectiveDate = resolveDate(date)
  const tables = await listTablesByRoom(roomId)
  if (tables.length === 0) {
    return {}
  }

  const admin = createSupabaseServerAdminClient()
  const reservations = admin.from('reservations') as unknown as ReservationsByTableClient
  const { data, error } = await reservations
    .select('id, table_id, date, start_time, end_time, status, surface, user_id, created_at')
    .eq('date', effectiveDate)
    .eq('status', 'active')
    .in('table_id', tables.map((table) => table.id))

  if (error) {
    serviceError('Internal server error', 500)
  }

  const reservationsByTable = new Map<string, ReservationRow[]>()
  for (const reservation of (data ?? []) as ReservationRow[]) {
    const items = reservationsByTable.get(reservation.table_id) ?? []
    items.push(reservation)
    reservationsByTable.set(reservation.table_id, items)
  }

  return tables.reduce<Record<string, TableAvailability>>((acc, table) => {
    acc[table.id] = buildAvailability(table, effectiveDate, reservationsByTable.get(table.id) ?? [])
    return acc
  }, {})
}
