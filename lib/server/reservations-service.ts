import type { Reservation, TableSurface } from '@/lib/types'
import type { SessionUser } from '@/lib/server/auth'
import { serviceError } from '@/lib/server/service-error'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

type ReservationRow = Tables<'reservations'>
type TableRow = Tables<'tables'>
type PostgrestErrorLike = { code?: string }
type TablesLookupClient = {
  select: () => {
    eq: (column: 'id', value: string) => {
      maybeSingle: () => Promise<{ data: TableRow | null; error: unknown }>
    }
  }
}
type AdminReservationsQuery = {
  eq: (column: 'id' | 'table_id' | 'date' | 'status', value: string) => AdminReservationsQuery
  neq: (column: 'id', value: string) => AdminReservationsQuery
  maybeSingle: () => Promise<{ data: ReservationRow | null; error: unknown }>
  then: Promise<{ data: ReservationRow[] | null; error: unknown }>['then']
}
type AdminReservationsTableClient = {
  select: (columns: string) => AdminReservationsQuery
}
type SessionReservationsQuery = {
  eq: (column: 'user_id' | 'table_id' | 'date', value: string) => SessionReservationsQuery
  order: (column: string, options: { ascending: boolean }) => SessionReservationsQuery
  then: Promise<{ data: ReservationRow[] | null; error: unknown }>['then']
}
type SessionReservationsTableClient = {
  select: (columns: string) => SessionReservationsQuery
  insert: (values: TablesInsert<'reservations'>) => {
    select: (columns: string) => {
      single: () => Promise<{ data: ReservationRow | null; error: PostgrestErrorLike | null }>
    }
  }
  update: (values: TablesUpdate<'reservations'>) => {
    eq: (column: 'id', value: string) => {
      select: (columns: string) => {
        single: () => Promise<{ data: ReservationRow | null; error: PostgrestErrorLike | null }>
      }
    }
  }
}

type EnrichedReservationRow = ReservationRow & {
  profiles?: { member_number: string } | null
  tables?: { name: string; rooms?: { name: string } | null } | null
}

type EnrichedReservationsQuery = {
  eq: (column: 'user_id' | 'table_id' | 'date', value: string) => EnrichedReservationsQuery
  order: (column: string, options: { ascending: boolean }) => EnrichedReservationsQuery
  then: Promise<{ data: EnrichedReservationRow[] | null; error: unknown }>['then']
}
type EnrichedReservationsTableClient = {
  select: (columns: string) => EnrichedReservationsQuery
}

const RESERVATION_COLUMNS = 'id, table_id, user_id, date, start_time, end_time, status, surface, created_at'
const RESERVATION_ENRICHED_COLUMNS = 'id, table_id, user_id, date, start_time, end_time, status, surface, created_at, profiles(member_number), tables(name, rooms(name))'

function parseDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    serviceError('Date must be in YYYY-MM-DD format', 400)
  }
  const d = new Date(value)
  if (isNaN(d.getTime())) {
    serviceError('Invalid date value', 400)
  }
  return value
}

function parseHHMM(value: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    serviceError('Time must be in HH:MM format (00:00–23:59)', 400)
  }
  return value
}

function parseSurface(value: unknown): TableSurface | undefined {
  return value === 'top' || value === 'bottom' ? value : undefined
}

function requireString(value: unknown): string {
  return String(value ?? '')
}

function normalizeTime(value: string) {
  return value.slice(0, 5)
}

function mapReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    tableId: row.table_id,
    userId: row.user_id,
    date: row.date,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    status: row.status,
    surface: row.surface,
    createdAt: row.created_at,
  }
}

function mapEnrichedReservation(row: EnrichedReservationRow): Reservation {
  return {
    id: row.id,
    tableId: row.table_id,
    userId: row.user_id,
    date: row.date,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    status: row.status,
    surface: row.surface,
    createdAt: row.created_at,
    memberNumber: row.profiles?.member_number ?? null,
    roomName: row.tables?.rooms?.name ?? null,
    tableName: row.tables?.name ?? null,
  }
}

async function getTable(tableId: string) {
  const supabase = await createSupabaseServerClient()
  const tables = supabase.from('tables') as unknown as TablesLookupClient
  const { data, error } = await tables
    .select()
    .eq('id', tableId)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data as TableRow | null
}

async function getReservationForAccess(reservationId: string) {
  const admin = createSupabaseServerAdminClient()
  const reservations = admin.from('reservations') as unknown as AdminReservationsTableClient
  const { data, error } = await reservations
    .select(RESERVATION_COLUMNS)
    .eq('id', reservationId)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data as ReservationRow | null
}

async function listActiveReservationsForConflict(input: {
  tableId: string
  date: string
  ignoreReservationId?: string
}) {
  const admin = createSupabaseServerAdminClient()
  const query = (admin.from('reservations') as unknown as AdminReservationsTableClient)
    .select(RESERVATION_COLUMNS)
    .eq('table_id', input.tableId)
    .eq('date', input.date)
    .eq('status', 'active')

  const result = input.ignoreReservationId
    ? await query.neq('id', input.ignoreReservationId)
    : await query
  const { data, error } = result

  if (error) {
    serviceError('Internal server error', 500)
  }

  return (data ?? []) as ReservationRow[]
}

function hasReservationConflict(
  existingReservations: ReservationRow[],
  input: {
    startTime: string
    endTime: string
    surface?: TableSurface
  },
) {
  return existingReservations.some((reservation) => {
    if (input.surface && reservation.surface && input.surface !== reservation.surface) {
      return false
    }

    const reservationStart = normalizeTime(reservation.start_time)
    const reservationEnd = normalizeTime(reservation.end_time)
    return reservationStart < input.endTime && input.startTime < reservationEnd
  })
}

function assertReservationAccess(
  session: SessionUser,
  reservation: ReservationRow | null,
): asserts reservation is ReservationRow {
  if (!reservation) {
    serviceError('Reservation not found', 404)
  }
  if (session.role !== 'admin' && reservation.user_id !== session.id) {
    serviceError('Forbidden', 403)
  }
}

function isConflictError(error: PostgrestErrorLike | null | undefined) {
  return error?.code === '23P01'
}

export async function listVisibleReservations(input: {
  session: SessionUser
  userId?: string | null
  tableId?: string | null
  date?: string | null
}) {
  // Use the admin client so the enriched join (profiles, tables, rooms) is not
  // silently blocked by RLS policies that restrict cross-user profile reads.
  const supabase = createSupabaseServerAdminClient()
  const effectiveUserId = input.session.role === 'admin' ? input.userId ?? undefined : input.session.id
  const effectiveDate = input.date != null && input.date !== '' ? parseDate(input.date) : undefined

  let query = (supabase.from('reservations') as unknown as EnrichedReservationsTableClient)
    .select(RESERVATION_ENRICHED_COLUMNS)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (effectiveUserId) {
    query = query.eq('user_id', effectiveUserId)
  }
  if (input.tableId) {
    query = query.eq('table_id', input.tableId)
  }
  if (effectiveDate) {
    query = query.eq('date', effectiveDate)
  }

  const { data, error } = await query

  if (error) {
    serviceError('Internal server error', 500)
  }

  const isAdmin = input.session.role === 'admin'
  return (data ?? []).map((row) => {
    const reservation = mapEnrichedReservation(row)
    if (!isAdmin) {
      reservation.memberNumber = undefined
    }
    return reservation
  })
}

export async function createReservationForSession(
  session: SessionUser,
  body: { tableId?: unknown; date?: unknown; startTime?: unknown; endTime?: unknown; surface?: unknown },
) {
  const tableId = requireString(body.tableId)
  const rawDate = requireString(body.date)
  const rawStartTime = requireString(body.startTime)
  const rawEndTime = requireString(body.endTime)
  const surface = parseSurface(body.surface)

  if (!tableId || !rawDate || !rawStartTime || !rawEndTime) {
    serviceError('tableId, date, startTime and endTime are required', 400)
  }

  const date = parseDate(rawDate)
  const startTime = parseHHMM(rawStartTime)
  const endTime = parseHHMM(rawEndTime)

  const table = await getTable(tableId)
  if (!table) {
    serviceError('Table not found', 404)
  }
  if (table.type === 'removable_top' && !surface) {
    serviceError('Surface is required for removable top tables', 400)
  }
  if (startTime >= endTime) {
    serviceError('Invalid reservation time range', 400)
  }

  const conflictingReservations = await listActiveReservationsForConflict({ tableId, date })
  if (hasReservationConflict(conflictingReservations, { startTime, endTime, surface })) {
    serviceError('Time slot is already reserved', 409)
  }

  const supabase = await createSupabaseServerClient()
  const insertPayload: TablesInsert<'reservations'> = {
    table_id: tableId,
    user_id: session.id,
    date,
    start_time: startTime,
    end_time: endTime,
    surface: surface ?? null,
  }
  const reservations = supabase.from('reservations') as unknown as SessionReservationsTableClient
  const { data, error } = await reservations
    .insert(insertPayload)
    .select(RESERVATION_COLUMNS)
    .single()

  if (error || !data) {
    if (isConflictError(error)) {
      serviceError('Time slot is already reserved', 409)
    }
    serviceError('Internal server error', 500)
  }

  return mapReservation(data as ReservationRow)
}

export async function checkReservationAccess(session: SessionUser, reservationId: string) {
  assertReservationAccess(session, await getReservationForAccess(reservationId))
}

export async function updateReservationForSession(
  session: SessionUser,
  reservationId: string,
  body: { status?: unknown; date?: unknown; startTime?: unknown; endTime?: unknown; surface?: unknown },
) {
  const existingReservation = await getReservationForAccess(reservationId)
  assertReservationAccess(session, existingReservation)

  const nextStatus = body.status
  if (nextStatus != null && !['active', 'cancelled', 'completed'].includes(String(nextStatus))) {
    serviceError('Invalid reservation status', 400)
  }
  if (nextStatus === 'completed' && session.role !== 'admin') {
    serviceError('Only admins can mark a reservation as completed', 403)
  }

  const nextStartTime = body.startTime == null
    ? normalizeTime(existingReservation.start_time)
    : parseHHMM(String(body.startTime))
  const nextEndTime = body.endTime == null
    ? normalizeTime(existingReservation.end_time)
    : parseHHMM(String(body.endTime))
  const nextDate = body.date == null ? existingReservation.date : parseDate(String(body.date))
  const nextSurface = body.surface === undefined || body.surface === null
    ? (existingReservation.surface ?? null)
    : (parseSurface(body.surface) ?? (existingReservation.surface ?? null))

  if (nextStartTime >= nextEndTime) {
    serviceError('Invalid reservation time range', 400)
  }

  const conflictingReservations = await listActiveReservationsForConflict({
    tableId: existingReservation.table_id,
    date: nextDate,
    ignoreReservationId: existingReservation.id,
  })
  if (hasReservationConflict(conflictingReservations, {
    startTime: nextStartTime,
    endTime: nextEndTime,
    surface: nextSurface ?? undefined,
  })) {
    serviceError('Time slot is already reserved', 409)
  }

  const supabase = await createSupabaseServerClient()
  const updatePayload: TablesUpdate<'reservations'> = {
    date: nextDate,
    start_time: nextStartTime,
    end_time: nextEndTime,
    surface: nextSurface,
    status: nextStatus == null ? existingReservation.status : String(nextStatus) as ReservationRow['status'],
  }
  const reservations = supabase.from('reservations') as unknown as SessionReservationsTableClient
  const { data, error } = await reservations
    .update(updatePayload)
    .eq('id', reservationId)
    .select(RESERVATION_COLUMNS)
    .single()

  if (error || !data) {
    if (isConflictError(error)) {
      serviceError('Time slot is already reserved', 409)
    }
    serviceError('Internal server error', 500)
  }

  return mapReservation(data as ReservationRow)
}
