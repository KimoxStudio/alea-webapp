import type { SavedGame, SavedGameStatus } from '@/lib/types'
import type { SessionUser } from '@/lib/server/auth'
import { getCurrentClubDate, isValidDateOnlyString } from '@/lib/club-time'
import { createSupabaseServerAdminClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'

type SavedGameRow = Tables<'saved_games'>
type SavedGameJoinedRow = SavedGameRow & {
  tables?: { name: string; rooms?: { name: string } | null } | null
}

const SAVED_GAME_COLUMNS = 'id, table_id, user_id, start_date, end_date, status, attendance_count, renewed_from_id, created_at, updated_at'
const SAVED_GAME_JOINED_COLUMNS = `${SAVED_GAME_COLUMNS}, tables(name, rooms(name))`

function parseDate(value: unknown, field: string) {
  const date = String(value ?? '')
  if (!isValidDateOnlyString(date)) serviceError(`${field} must be a valid date`, 400)
  return date
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

function addMonthsClamped(date: string, months: number) {
  const [year, month, day] = date.split('-').map(Number)
  const targetMonth = month - 1 + months
  const targetYear = year + Math.floor(targetMonth / 12)
  const normalizedMonth = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

function getMaxEndDate(startDate: string) {
  return addDays(addMonthsClamped(startDate, 3), -1)
}

function mapSavedGame(row: SavedGameJoinedRow, today = getCurrentClubDate()): SavedGame {
  const renewalOpensOn = addDays(row.end_date, -14)
  const status = row.status === 'active' && row.end_date < today ? 'completed' : row.status
  return {
    id: row.id,
    tableId: row.table_id,
    userId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    status: status as SavedGameStatus,
    attendanceCount: row.attendance_count,
    renewedFromId: row.renewed_from_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    roomName: row.tables?.rooms?.name ?? null,
    tableName: row.tables?.name ?? null,
    renewalOpensOn,
    canRenew: status === 'active' && today >= renewalOpensOn && today <= row.end_date,
  }
}

async function assertTableAndEventAvailability(tableId: string, startDate: string, endDate: string) {
  const admin = createSupabaseServerAdminClient()
  const { data: table, error: tableError } = await admin
    .from('tables')
    .select('id, room_id, type')
    .eq('id', tableId)
    .maybeSingle()

  if (tableError) serviceError('Internal server error', 500)
  if (!table) serviceError('Table not found', 404)
  if (table.type !== 'removable_top') serviceError('SAVED_GAME_REQUIRES_REMOVABLE_TOP', 400)

  const { data: blocks, error: blocksError } = await admin
    .from('event_room_blocks')
    .select('id, table_id')
    .eq('room_id', table.room_id)
    .gte('date', startDate)
    .lte('date', endDate)

  if (blocksError) serviceError('Internal server error', 500)

  // OIR-208: a block with a table_id only conflicts with that single table;
  // NULL (the pre-OIR-208 default) conflicts with every table of the room —
  // saved games only ever live on a single removable-top table.
  const hasConflict = ((blocks ?? []) as Array<{ id: string; table_id: string | null }>).some(
    (block) => block.table_id == null || block.table_id === tableId,
  )
  if (hasConflict) serviceError('SAVED_GAME_EVENT_CONFLICT', 409)
}

function validateDateRange(startDate: string, endDate: string) {
  const today = getCurrentClubDate()
  if (startDate < today) serviceError('SAVED_GAME_START_IN_PAST', 400)
  if (endDate < startDate) serviceError('SAVED_GAME_INVALID_RANGE', 400)
  if (endDate > getMaxEndDate(startDate)) serviceError('SAVED_GAME_MAX_DURATION', 400)
}

export async function listSavedGamesForSession(session: SessionUser): Promise<SavedGame[]> {
  const admin = createSupabaseServerAdminClient()
  const today = getCurrentClubDate()
  let query = admin
    .from('saved_games')
    .select(SAVED_GAME_JOINED_COLUMNS)
    .order('start_date', { ascending: true })

  if (session.role !== 'admin') query = query.eq('user_id', session.id)
  const { data, error } = await query
  if (error) serviceError('Internal server error', 500)

  return ((data ?? []) as unknown as SavedGameJoinedRow[]).map((row) => mapSavedGame(row, today))
}

export async function createSavedGameForSession(
  session: SessionUser,
  body: { tableId?: unknown; startDate?: unknown; endDate?: unknown },
): Promise<SavedGame> {
  const tableId = String(body.tableId ?? '')
  if (!tableId) serviceError('tableId is required', 400)
  const startDate = parseDate(body.startDate, 'startDate')
  const endDate = parseDate(body.endDate, 'endDate')
  validateDateRange(startDate, endDate)
  await assertTableAndEventAvailability(tableId, startDate, endDate)

  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('saved_games')
    .insert({ table_id: tableId, user_id: session.id, start_date: startDate, end_date: endDate })
    .select(SAVED_GAME_JOINED_COLUMNS)
    .single()

  if (error?.code === '23P01') serviceError('SAVED_GAME_CONFLICT', 409)
  if (error?.code === '23514') serviceError(error.message, 400)
  if (error || !data) serviceError('Internal server error', 500)
  return mapSavedGame(data as unknown as SavedGameJoinedRow)
}

export async function renewSavedGameForSession(session: SessionUser, id: string): Promise<SavedGame> {
  const admin = createSupabaseServerAdminClient()
  const { data: current, error: currentError } = await admin
    .from('saved_games')
    .select(SAVED_GAME_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (currentError) serviceError('Internal server error', 500)
  if (!current) serviceError('Saved Game not found', 404)
  if (session.role !== 'admin' && current.user_id !== session.id) serviceError('Forbidden', 403)
  if (current.status !== 'active') serviceError('SAVED_GAME_NOT_ACTIVE', 409)

  const today = getCurrentClubDate()
  const renewalOpensOn = addDays(current.end_date, -14)
  if (today < renewalOpensOn || today > current.end_date) serviceError('SAVED_GAME_RENEWAL_NOT_OPEN', 409)

  const startDate = addDays(current.end_date, 1)
  const endDate = getMaxEndDate(startDate)
  await assertTableAndEventAvailability(current.table_id, startDate, endDate)

  const { data, error } = await admin
    .from('saved_games')
    .insert({
      table_id: current.table_id,
      user_id: current.user_id,
      start_date: startDate,
      end_date: endDate,
      renewed_from_id: current.id,
    })
    .select(SAVED_GAME_JOINED_COLUMNS)
    .single()

  if (error?.code === '23505') serviceError('SAVED_GAME_ALREADY_RENEWED', 409)
  if (error?.code === '23P01') serviceError('SAVED_GAME_CONFLICT', 409)
  if (error || !data) serviceError('Internal server error', 500)
  return mapSavedGame(data as unknown as SavedGameJoinedRow, today)
}

export async function recordSavedGameAttendance(playReservation: Tables<'reservations'>): Promise<void> {
  if (playReservation.surface !== 'top' || playReservation.status !== 'active') return

  const admin = createSupabaseServerAdminClient()
  const { data: savedGame, error } = await admin
    .from('saved_games')
    .select('id')
    .eq('table_id', playReservation.table_id)
    .eq('user_id', playReservation.user_id)
    .eq('status', 'active')
    .lte('start_date', playReservation.date)
    .gte('end_date', playReservation.date)
    .maybeSingle()

  if (error) serviceError('Internal server error', 500)
  if (!savedGame) return

  const { error: attendanceError } = await admin.from('saved_game_attendances').insert({
    saved_game_id: savedGame.id,
    play_reservation_id: playReservation.id,
    attended_on: playReservation.date,
  })

  if (attendanceError?.code !== '23505' && attendanceError) serviceError('Internal server error', 500)
}
