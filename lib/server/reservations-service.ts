import type { Reservation, TableSurface } from '@/lib/types'
import type { SessionUser } from '@/lib/server/auth'
import { CLUB_TIMEZONE, getCurrentClubDate, isValidDateOnlyString, zonedDateTimeToUtc } from '@/lib/club-time'
import { getDatabaseNow } from '@/lib/server/database-time'
import { serviceError } from '@/lib/server/service-error'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'

type ReservationRow = Tables<'reservations'>
type TableRow = Tables<'tables'>
type PostgrestErrorLike = { code?: string }
type TablesLookupClient = {
  select: (columns?: string) => {
    eq: (column: 'id', value: string) => {
      maybeSingle: () => Promise<{ data: TableRow | null; error: unknown }>
    }
  }
}
type AdminReservationsQuery = {
  eq: (column: 'id' | 'table_id' | 'date' | 'status', value: string) => AdminReservationsQuery
  neq: (column: 'id', value: string) => AdminReservationsQuery
  in: (column: 'status', values: string[]) => AdminReservationsQuery
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
type UserSlotOverlapQuery = {
  eq: (column: 'user_id' | 'date', value: string) => UserSlotOverlapQuery
  neq: (column: 'id', value: string) => UserSlotOverlapQuery
  in: (column: 'status', values: string[]) => UserSlotOverlapQuery
  lt: (column: 'start_time' | 'end_time', value: string) => UserSlotOverlapQuery
  gt: (column: 'start_time' | 'end_time', value: string) => UserSlotOverlapQuery
  limit: (count: number) => Promise<{ data: Array<{ id: string }> | null; error: unknown }>
  then: Promise<{ data: ReservationRow[] | null; error: unknown }>['then']
}
type UserSlotOverlapTableClient = {
  select: (columns: string) => UserSlotOverlapQuery
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

export const GRACE_PERIOD_MINUTES = 20
// How many minutes before the reservation start time check-in is allowed.
export const CHECK_IN_EARLY_MINUTES = 5
const CANCELLATION_CUTOFF_MS = 60 * 60 * 1000 // 60 minutes

const RESERVATION_COLUMNS = 'id, table_id, user_id, date, start_time, end_time, status, surface, activated_at, created_at'
const RESERVATION_ENRICHED_COLUMNS = 'id, table_id, user_id, date, start_time, end_time, status, surface, activated_at, created_at, profiles(member_number), tables(name, rooms(name))'

function parseDate(value: string): string {
  if (!isValidDateOnlyString(value)) {
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

function assertReservationNotInPast(date: string, startTime: string, now: Date = new Date()) {
  const todayInClub = getCurrentClubDate(now)
  if (date < todayInClub) {
    serviceError('Cannot make a reservation in the past', 400)
  }
  if (date === todayInClub) {
    const reservationStart = zonedDateTimeToUtc(date, startTime)
    if (reservationStart.getTime() < now.getTime()) {
      serviceError('Cannot make a reservation in the past', 400)
    }
  }
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
    activatedAt: row.activated_at ?? null,
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
    activatedAt: row.activated_at ?? null,
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
    .select('id, type, room_id')
    .eq('id', tableId)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }

  return data as TableRow | null
}

async function hasEventBlockConflict(input: {
  roomId: string
  date: string
  startTime: string
  endTime: string
}) {
  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('event_room_blocks')
    .select('id')
    .eq('room_id', input.roomId)
    .eq('date', input.date)
    .lt('start_time', input.endTime)
    .gt('end_time', input.startTime)
    .limit(1)

  if (error) {
    serviceError('Internal server error', 500)
  }

  return Boolean(data && data.length > 0)
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
    .in('status', ['active', 'pending'])

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
  // Admin sessions use the admin client so the cross-user profiles join is not
  // silently blocked by RLS. Member sessions use the session client so RLS
  // remains an additional safety net (the member can only join their own profile row).
  const supabase = input.session.role === 'admin'
    ? createSupabaseServerAdminClient()
    : await createSupabaseServerClient()
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

async function checkUserSlotOverlap(
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ignoreReservationId?: string,
) {
  let query = (supabase.from('reservations') as unknown as UserSlotOverlapTableClient)
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .in('status', ['pending', 'active'])
    .lt('start_time', endTime)
    .gt('end_time', startTime)

  if (ignoreReservationId) {
    query = query.neq('id', ignoreReservationId)
  }

  const { data, error } = await query
    .limit(1)

  if (error) {
    serviceError('Internal server error', 500)
  }

  if (data && data.length > 0) {
    serviceError('USER_ALREADY_HAS_RESERVATION_IN_SLOT', 409)
  }
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

  assertReservationNotInPast(date, startTime)

  const supabase = await createSupabaseServerClient()

  await checkUserSlotOverlap(session.id, date, startTime, endTime, supabase)

  const conflictingReservations = await listActiveReservationsForConflict({ tableId, date })
  if (hasReservationConflict(conflictingReservations, { startTime, endTime, surface })) {
    serviceError('Time slot is already reserved', 409)
  }
  if (await hasEventBlockConflict({ roomId: table.room_id, date, startTime, endTime })) {
    serviceError('ROOM_BLOCKED_BY_EVENT', 409)
  }
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
  if (nextStatus != null && !['active', 'cancelled', 'completed', 'pending', 'no_show'].includes(String(nextStatus))) {
    serviceError('Invalid reservation status', 400)
  }
  if (nextStatus === 'active' && session.role !== 'admin') {
    serviceError('STATUS_TRANSITION_FORBIDDEN', 403)
  }
  if ((nextStatus === 'completed' || nextStatus === 'no_show') && session.role !== 'admin') {
    serviceError('Only admins can mark a reservation as completed or no_show', 403)
  }

  if (nextStatus === 'cancelled' && session.role !== 'admin' && existingReservation.status !== 'cancelled') {
    const reservationStart = zonedDateTimeToUtc(
      existingReservation.date,
      normalizeTime(existingReservation.start_time),
    )
    if (isNaN(reservationStart.getTime())) {
      serviceError('Invalid reservation time format', 500)
    }
    const now = new Date()
    if (reservationStart.getTime() - now.getTime() < CANCELLATION_CUTOFF_MS) {
      serviceError('CANCELLATION_CUTOFF', 403)
    }
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
  const table = await getTable(existingReservation.table_id)

  if (!table) {
    serviceError('Table not found', 404)
  }

  if (nextStartTime >= nextEndTime) {
    serviceError('Invalid reservation time range', 400)
  }

  const isScheduleChange = body.date != null || body.startTime != null || body.endTime != null
  const needsUserOverlapCheck = isScheduleChange || nextStatus === 'active'
  if (isScheduleChange) {
    assertReservationNotInPast(nextDate, nextStartTime)
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
  if (await hasEventBlockConflict({
    roomId: table.room_id,
    date: nextDate,
    startTime: nextStartTime,
    endTime: nextEndTime,
  })) {
    serviceError('ROOM_BLOCKED_BY_EVENT', 409)
  }

  const supabase = await createSupabaseServerClient()
  if (needsUserOverlapCheck) {
    await checkUserSlotOverlap(
      existingReservation.user_id,
      nextDate,
      nextStartTime,
      nextEndTime,
      supabase,
      existingReservation.id,
    )
  }
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

export async function cancelExpiredPendingReservations(): Promise<number> {
  const admin = createSupabaseServerAdminClient()
  const { data, error } = await (admin as unknown as {
    rpc: (fn: string, args?: unknown) => Promise<{ data: number | null; error: unknown }>
  }).rpc('cancel_expired_pending_reservations', {
    grace_minutes: GRACE_PERIOD_MINUTES,
    club_timezone: CLUB_TIMEZONE,
  })
  if (error) serviceError('Internal server error', 500)
  return (data as number | null) ?? 0
}

export async function markNoShowReservations(): Promise<number> {
  const admin = createSupabaseServerAdminClient()
  const { data, error } = await (admin as unknown as {
    rpc: (fn: string, args?: unknown) => Promise<{ data: number | null; error: unknown }>
  }).rpc('mark_no_show_reservations', {
    club_timezone: CLUB_TIMEZONE,
  })
  if (error) serviceError('Internal server error', 500)
  return (data as number | null) ?? 0
}

type ActivationAdminQuery = {
  eq: (column: 'table_id' | 'date' | 'status' | 'user_id' | 'surface' | 'id', value: string) => ActivationAdminQuery
  or: (filter: string) => ActivationAdminQuery
  maybeSingle: () => Promise<{ data: ReservationRow | null; error: unknown }>
  select: (columns?: string) => ActivationAdminQuery
  update: (values: TablesUpdate<'reservations'>) => ActivationAdminQuery
  single: () => Promise<{ data: ReservationRow | null; error: PostgrestErrorLike | null }>
  then: Promise<{ data: ReservationRow | null; error: PostgrestErrorLike | null }>['then']
}

export async function activateReservationByTable(
  tableId: string,
  userId: string,
  side?: 'inf',
): Promise<Reservation> {
  // Anchor "today" in the club's local timezone so near-midnight requests on
  // DST transition days resolve to the correct calendar date.
  const today = getCurrentClubDate()

  // Look up the table via the session-scoped client to decide whether to apply
  // a surface filter. removable_top tables store surface='top'/'bottom'; all
  // other types store null — filtering by surface for those would always fail.
  const table = await getTable(tableId)
  if (!table) {
    serviceError('Table not found', 404)
  }
  const isRemovableTop = table.type === 'removable_top'

  const admin = createSupabaseServerAdminClient()

  let pendingQuery = (admin.from('reservations') as unknown as { select: (c: string) => ActivationAdminQuery })
    .select(RESERVATION_COLUMNS)
    .eq('table_id', tableId)
    .eq('date', today)
    .eq('user_id', userId)
    .eq('status', 'pending')

  if (side === 'inf') {
    pendingQuery = pendingQuery.eq('surface', 'bottom')
  } else if (isRemovableTop) {
    // Only filter by surface for removable_top tables — other types store null
    // and an .eq('surface', 'top') filter would incorrectly exclude their rows.
    pendingQuery = pendingQuery.eq('surface', 'top')
  }

  const { data: pendingData, error: pendingError } = await pendingQuery.maybeSingle()

  if (pendingError) {
    serviceError('Internal server error', 500)
  }

  if (!pendingData) {
    let activeQuery = (admin.from('reservations') as unknown as { select: (c: string) => ActivationAdminQuery })
      .select(RESERVATION_COLUMNS)
      .eq('table_id', tableId)
      .eq('date', today)
      .eq('user_id', userId)
      .eq('status', 'active')

    if (side === 'inf') {
      activeQuery = activeQuery.eq('surface', 'bottom')
    } else if (isRemovableTop) {
      activeQuery = activeQuery.eq('surface', 'top')
    }

    const { data: activeData, error: activeError } = await activeQuery.maybeSingle()

    if (activeError) {
      serviceError('Internal server error', 500)
    }

    if (activeData) {
      serviceError('CHECK_IN_ALREADY_ACTIVE', 409)
    }

    serviceError('CHECK_IN_NO_RESERVATION', 404)
  }

  const reservation = pendingData as ReservationRow

  if (!reservation.end_time) {
    serviceError('Invalid reservation data', 500)
  }

  const nowUtc = await getDatabaseNow(admin)
  const reservationStart = zonedDateTimeToUtc(reservation.date, normalizeTime(reservation.start_time))
  const reservationEnd = zonedDateTimeToUtc(reservation.date, normalizeTime(reservation.end_time))

  if (reservationEnd <= reservationStart) {
    serviceError('Invalid reservation data', 500)
  }

  // Allow check-in starting CHECK_IN_EARLY_MINUTES before the slot begins,
  // up to the end of the reserved slot.
  const windowStart = new Date(reservationStart.getTime() - CHECK_IN_EARLY_MINUTES * 60 * 1000)

  if (nowUtc < windowStart) {
    serviceError('CHECK_IN_TOO_EARLY', 400)
  }
  if (nowUtc > reservationEnd) {
    serviceError('CHECK_IN_TOO_LATE', 400)
  }

  const { data: updated, error: updateError } = await admin
    .from('reservations')
    .update({ status: 'active', activated_at: nowUtc.toISOString() })
    .eq('id', reservation.id)
    .eq('status', 'pending')
    .select(RESERVATION_COLUMNS)
    .single()

  // PGRST116: PostgREST returns this code when .single() matches zero rows.
  // Here it means the reservation was already activated by a concurrent request
  // (TOCTOU race) between our read and this UPDATE. Return 409, not 500.
  if ((updateError as PostgrestErrorLike | null)?.code === 'PGRST116') {
    serviceError('CHECK_IN_ALREADY_ACTIVE', 409)
  }
  if (updateError) {
    serviceError('Internal server error', 500)
  }
  if (!updated) {
    serviceError('CHECK_IN_ALREADY_ACTIVE', 409)
  }

  return mapReservation(updated as ReservationRow)
}
