import 'server-only'
import type { AdminLibraryGame, LibraryGame } from '@/lib/types'
import { createSupabaseServerClient, createSupabaseServerAdminClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'
import type { SessionUser } from '@/lib/server/auth'

type LibraryGameRow = Tables<'library_games'>

const PUBLIC_LIBRARY_GAME_COLUMNS = 'id, title, category_es, category_en, players, play_time, weight, sort_order'
const ADMIN_LIBRARY_GAME_COLUMNS = 'id, title, category_es, category_en, players, play_time, weight, sort_order, active'

function toLibraryGame(row: Pick<LibraryGameRow, 'id' | 'title' | 'category_es' | 'category_en' | 'players' | 'play_time' | 'weight' | 'sort_order'>): LibraryGame {
  return {
    id: row.id,
    title: row.title,
    categoryEs: row.category_es,
    categoryEn: row.category_en,
    players: row.players,
    playTime: row.play_time,
    weight: Number(row.weight),
    sortOrder: row.sort_order,
  }
}

function toAdminLibraryGame(row: LibraryGameRow): AdminLibraryGame {
  return { ...toLibraryGame(row), active: row.active }
}

/**
 * Public read of active library games (ludoteca highlights) for the landing
 * page, ordered the same way the board arranges them in the dashboard. Uses
 * the RLS-respecting client since this is unauthenticated, publicly readable
 * content — the "library_games_select_active" RLS policy additionally
 * restricts anon/authenticated visibility to active rows.
 */
export async function listLibraryGames(): Promise<LibraryGame[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('library_games')
    .select(PUBLIC_LIBRARY_GAME_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) serviceError('Internal server error', 500)

  const rows = (data ?? []) as LibraryGameRow[]
  return rows.map((row) => toLibraryGame(row))
}

// ---------------------------------------------------------------------------
// Admin CRUD (OIR-205)
//
// Privilege checks (role === 'admin') live here in the service layer, not in
// the route handlers, so every entry point is protected regardless of how
// it's invoked — same pattern as the OIR-204 partners service.
// ---------------------------------------------------------------------------

export interface LibraryGameInput {
  title?: unknown
  categoryEs?: unknown
  categoryEn?: unknown
  players?: unknown
  playTime?: unknown
  weight?: unknown
  sortOrder?: unknown
  active?: unknown
}

function requireAdminSession(session: SessionUser): void {
  if (session.role !== 'admin') serviceError('Forbidden', 403)
}

function requireNonEmptyString(value: unknown, field: string): string {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) serviceError(`${field} is required`, 400)
  return str
}

function optionalInteger(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(num)) serviceError(`${field} must be an integer`, 400)
  return num
}

function parseBooleanFlag(value: unknown): boolean {
  return value === true || value === 'true'
}

/** weight is a numeric(2,1) column: required, must be a number in [0, 5]. */
function requireWeight(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value)
  if (typeof value !== 'number' && typeof value !== 'string') serviceError('weight must be a number', 400)
  if (!Number.isFinite(num) || num < 0 || num > 5) serviceError('weight must be a number between 0 and 5', 400)
  return num
}

interface LibraryGameFieldSet {
  title: string
  category_es: string
  category_en: string
  players: string
  play_time: string
  weight: number
  sort_order: number
  active: boolean
}

/**
 * Resolve the full field set for a create/update, falling back to the
 * current row's values for anything omitted from the payload. `current` is
 * null for creates, where every field not provided by the caller falls back
 * to required-field validation instead. Validation happens here, before any
 * DB write.
 */
function resolveLibraryGameFields(body: LibraryGameInput, current: LibraryGameRow | null): LibraryGameFieldSet {
  const title = body.title !== undefined
    ? requireNonEmptyString(body.title, 'title')
    : requireNonEmptyString(current?.title, 'title')

  const categoryEs = body.categoryEs !== undefined
    ? requireNonEmptyString(body.categoryEs, 'categoryEs')
    : requireNonEmptyString(current?.category_es, 'categoryEs')

  const categoryEn = body.categoryEn !== undefined
    ? requireNonEmptyString(body.categoryEn, 'categoryEn')
    : requireNonEmptyString(current?.category_en, 'categoryEn')

  const players = body.players !== undefined
    ? requireNonEmptyString(body.players, 'players')
    : requireNonEmptyString(current?.players, 'players')

  const playTime = body.playTime !== undefined
    ? requireNonEmptyString(body.playTime, 'playTime')
    : requireNonEmptyString(current?.play_time, 'playTime')

  const weight = body.weight !== undefined
    ? requireWeight(body.weight)
    : requireWeight(current?.weight)

  const sortOrder = body.sortOrder !== undefined
    ? (optionalInteger(body.sortOrder, 'sortOrder') ?? 0)
    : (current?.sort_order ?? 0)

  const active = body.active !== undefined ? parseBooleanFlag(body.active) : (current?.active ?? true)

  return {
    title,
    category_es: categoryEs,
    category_en: categoryEn,
    players,
    play_time: playTime,
    weight,
    sort_order: sortOrder,
    active,
  }
}

/** Admin read of every library game (active + inactive), ordered by sort_order. */
export async function listAdminLibraryGames(session: SessionUser): Promise<AdminLibraryGame[]> {
  requireAdminSession(session)

  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('library_games')
    .select(ADMIN_LIBRARY_GAME_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true })

  if (error) serviceError('Internal server error', 500)

  const rows = (data ?? []) as LibraryGameRow[]
  return rows.map((row) => toAdminLibraryGame(row))
}

export async function createLibraryGame(session: SessionUser, body: LibraryGameInput): Promise<AdminLibraryGame> {
  requireAdminSession(session)

  // Validate EVERYTHING before any DB write.
  const fields = resolveLibraryGameFields(body, null)

  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('library_games')
    .insert(fields)
    .select(ADMIN_LIBRARY_GAME_COLUMNS)
    .maybeSingle()

  if (error) {
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
      serviceError('Invalid library game data', 400)
    }
    serviceError('Internal server error', 500)
  }
  if (!data) serviceError('Internal server error', 500)

  return toAdminLibraryGame(data as LibraryGameRow)
}

export async function updateLibraryGame(session: SessionUser, id: string, body: LibraryGameInput): Promise<AdminLibraryGame> {
  requireAdminSession(session)

  const admin = createSupabaseServerAdminClient()
  const { data: currentData, error: fetchError } = await admin
    .from('library_games')
    .select(ADMIN_LIBRARY_GAME_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (fetchError) serviceError('Internal server error', 500)
  const current = currentData as LibraryGameRow | null
  if (!current) serviceError('Library game not found', 404)

  // Validate EVERYTHING before the UPDATE below.
  const fields = resolveLibraryGameFields(body, current)

  const { data, error } = await admin
    .from('library_games')
    .update(fields)
    .eq('id', id)
    .select(ADMIN_LIBRARY_GAME_COLUMNS)
    .maybeSingle()

  if (error) {
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
      serviceError('Invalid library game data', 400)
    }
    serviceError('Internal server error', 500)
  }
  if (!data) serviceError('Library game not found', 404)

  return toAdminLibraryGame(data as LibraryGameRow)
}

export async function deleteLibraryGame(session: SessionUser, id: string): Promise<void> {
  requireAdminSession(session)

  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('library_games')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) serviceError('Internal server error', 500)
  if (!data) serviceError('Library game not found', 404)

  const { error: deleteError } = await admin.from('library_games').delete().eq('id', id)
  if (deleteError) serviceError('Internal server error', 500)
}
