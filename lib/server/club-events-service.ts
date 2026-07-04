import 'server-only'
import type {
  AdminClubEvent,
  AdminEventRoomBlock,
  AdminListClubEventsResult,
  ClubEvent,
  ClubEventDateKind,
  ClubEventStatus,
} from '@/lib/types'
import { createSupabaseServerClient, createSupabaseServerAdminClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import { getCurrentClubDate } from '@/lib/club-time'
import type { Tables } from '@/lib/supabase/types'
import type { SessionUser } from '@/lib/server/auth'
import { deleteEvent, validateAndNormaliseSchedule, type NormalisedEventSchedule } from '@/lib/server/events-service'

export type { AdminClubEvent, AdminListClubEventsResult }

type EventRow = Tables<'events'>
type EventRoomBlockRow = Tables<'event_room_blocks'>

const CLUB_EVENT_COLUMNS = 'id, title_es, title_en, blurb_es, blurb_en, description_es, description_en, date_kind, date, end_date, recurrence_label_es, recurrence_label_en, image_url, link_url'

// Same as CLUB_EVENT_COLUMNS plus the admin-only category fields and id/date
// needed to drive the dashboard "Club events" management view (OIR-203).
// Kept as its own string literal (not built via concatenation) so Supabase's
// select() overload can still infer a concrete row shape.
const ADMIN_CLUB_EVENT_COLUMNS = 'id, title_es, title_en, blurb_es, blurb_en, description_es, description_en, date_kind, date, end_date, recurrence_label_es, recurrence_label_en, image_url, link_url, category_es, category_en'

const DEFAULT_PAST_LIMIT = 24

/**
 * "Upcoming" vs "past" is derived from date/end_date at read time rather than
 * stored — a recurring event (e.g. "every Friday") is always upcoming since
 * it has no defined end.
 */
function statusFor(row: Pick<EventRow, 'date_kind' | 'date' | 'end_date'>, today: string): ClubEventStatus {
  if (row.date_kind === 'recurring') return 'upcoming'
  const referenceDate = row.end_date ?? row.date
  return referenceDate < today ? 'past' : 'upcoming'
}

function toClubEvent(row: EventRow, today: string): ClubEvent {
  return {
    id: row.id,
    titleEs: row.title_es ?? row.title,
    titleEn: row.title_en ?? row.title,
    blurbEs: row.blurb_es ?? '',
    blurbEn: row.blurb_en ?? '',
    descriptionEs: row.description_es,
    descriptionEn: row.description_en,
    dateKind: (row.date_kind as ClubEventDateKind) ?? 'single',
    startDate: row.date,
    endDate: row.end_date,
    recurrenceLabelEs: row.recurrence_label_es,
    recurrenceLabelEn: row.recurrence_label_en,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    status: statusFor(row, today),
  }
}

export interface ListClubEventsOptions {
  /** Maximum number of past events to return (most recent first). Defaults to 24. */
  pastLimit?: number
}

export interface ListClubEventsResult {
  upcoming: ClubEvent[]
  past: ClubEvent[]
}

/**
 * Public read of club marketing events (tournaments, game nights, club
 * history) for the landing page. These live in the same "events" table used
 * for internal room-reservation blocking (lib/server/events-service.ts) —
 * a row is landing-eligible once it carries bilingual copy (title_es/title_en).
 * Uses the RLS-respecting client since this is unauthenticated, publicly
 * readable content; the "events_select_public" RLS policy additionally
 * restricts anon visibility to rows with bilingual copy populated.
 */
export async function listClubEvents(options: ListClubEventsOptions = {}): Promise<ListClubEventsResult> {
  const pastLimit = options.pastLimit ?? DEFAULT_PAST_LIMIT
  const today = getCurrentClubDate()

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('events')
    .select(CLUB_EVENT_COLUMNS)
    .not('title_es', 'is', null)
    .not('title_en', 'is', null)
    .order('date', { ascending: true })

  if (error) {
    serviceError('Internal server error', 500)
  }

  const rows = (data ?? []) as EventRow[]
  const events = rows.map((row) => toClubEvent(row, today))

  const upcoming = events.filter((event) => event.status === 'upcoming')
  const past = events
    .filter((event) => event.status === 'past')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, pastLimit)

  return { upcoming, past }
}

// ---------------------------------------------------------------------------
// Admin CRUD (OIR-203)
//
// Public club events are rows in the same "events" table used for internal
// room-reservation blocking. Room blocking is optional: creating/updating a
// club event never creates event_room_blocks rows unless the admin
// explicitly attaches them via `blocksRooms` + `schedules` (reusing the same
// validation as the internal admin event flow in events-service.ts).
//
// Privilege checks (role === 'admin') live here in the service layer, not in
// the route handlers, so every entry point is protected regardless of how
// it's invoked.
// ---------------------------------------------------------------------------

export interface ClubEventInput {
  titleEs?: unknown
  titleEn?: unknown
  blurbEs?: unknown
  blurbEn?: unknown
  descriptionEs?: unknown
  descriptionEn?: unknown
  dateKind?: unknown
  date?: unknown
  endDate?: unknown
  recurrenceLabelEs?: unknown
  recurrenceLabelEn?: unknown
  imageUrl?: unknown
  linkUrl?: unknown
  categoryEs?: unknown
  categoryEn?: unknown
  /** When true, `schedules` is required and creates/replaces room blocks. */
  blocksRooms?: unknown
  schedules?: unknown
}

function requireAdminSession(session: SessionUser): void {
  if (session.role !== 'admin') serviceError('Forbidden', 403)
}

function requireNonEmptyString(value: unknown, field: string): string {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!str) serviceError(`${field} is required`, 400)
  return str
}

function optionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const str = String(value).trim()
  return str === '' ? null : str
}

const CLUB_EVENT_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function requireDateString(value: unknown, field: string): string {
  const str = typeof value === 'string' ? value.trim() : ''
  if (!CLUB_EVENT_DATE_RE.test(str)) serviceError(`${field} must be in YYYY-MM-DD format`, 400)
  return str
}

function optionalDateString(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null
  const str = String(value).trim()
  if (!CLUB_EVENT_DATE_RE.test(str)) serviceError(`${field} must be in YYYY-MM-DD format`, 400)
  return str
}

function normaliseDateKind(value: unknown): ClubEventDateKind {
  const str = String(value ?? '').trim()
  if (str !== 'single' && str !== 'range' && str !== 'recurring') {
    serviceError('dateKind must be one of single, range, recurring', 400)
  }
  return str as ClubEventDateKind
}

function parseBooleanFlag(value: unknown): boolean {
  return value === true || value === 'true'
}

// URL hardening (MEDIUM finding from PR #148 security review): image_url and
// link_url only accept absolute http(s) URLs (or empty/omitted). Anything
// else — javascript:, data:, relative paths — is rejected here before the
// board can ever save it, since these values render as <img src>/<a href> on
// the public landing page.
const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:'])

function validateOptionalUrl(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  const str = String(value).trim()
  if (str === '') return null

  let parsed: URL
  try {
    parsed = new URL(str)
  } catch {
    serviceError(`${field} must be an absolute http(s) URL`, 400)
  }
  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    serviceError(`${field} must be an absolute http(s) URL`, 400)
  }
  return str
}

interface ClubEventFieldSet {
  title_es: string
  title_en: string
  blurb_es: string | null
  blurb_en: string | null
  description_es: string | null
  description_en: string | null
  category_es: string | null
  category_en: string | null
  date_kind: ClubEventDateKind
  date: string
  end_date: string | null
  recurrence_label_es: string | null
  recurrence_label_en: string | null
  image_url: string | null
  link_url: string | null
  // Legacy single-locale anchor columns kept NOT NULL by the original
  // "events" schema — mirrored from the ES copy / all-day sentinel, same
  // convention used by the OIR-202 seed migration, since club events have no
  // meaningful room-block time-of-day unless blocksRooms is also set.
  title: string
  description: string | null
  start_time: string
  end_time: string
}

/**
 * Resolve the full field set for a create/update, falling back to the
 * current row's values for anything omitted from the payload. `current` is
 * null for creates, where every field not provided by the caller falls back
 * to empty/required validation instead.
 */
function resolveClubEventFields(body: ClubEventInput, current: EventRow | null): ClubEventFieldSet {
  const titleEs = body.titleEs !== undefined
    ? requireNonEmptyString(body.titleEs, 'titleEs')
    : requireNonEmptyString(current?.title_es, 'titleEs')
  const titleEn = body.titleEn !== undefined
    ? requireNonEmptyString(body.titleEn, 'titleEn')
    : requireNonEmptyString(current?.title_en, 'titleEn')

  const blurbEs = body.blurbEs !== undefined ? optionalString(body.blurbEs) : (current?.blurb_es ?? null)
  const blurbEn = body.blurbEn !== undefined ? optionalString(body.blurbEn) : (current?.blurb_en ?? null)
  const descriptionEs = body.descriptionEs !== undefined ? optionalString(body.descriptionEs) : (current?.description_es ?? null)
  const descriptionEn = body.descriptionEn !== undefined ? optionalString(body.descriptionEn) : (current?.description_en ?? null)
  const categoryEs = body.categoryEs !== undefined ? optionalString(body.categoryEs) : (current?.category_es ?? null)
  const categoryEn = body.categoryEn !== undefined ? optionalString(body.categoryEn) : (current?.category_en ?? null)
  const recurrenceLabelEs = body.recurrenceLabelEs !== undefined
    ? optionalString(body.recurrenceLabelEs)
    : (current?.recurrence_label_es ?? null)
  const recurrenceLabelEn = body.recurrenceLabelEn !== undefined
    ? optionalString(body.recurrenceLabelEn)
    : (current?.recurrence_label_en ?? null)

  const dateKind = body.dateKind !== undefined
    ? normaliseDateKind(body.dateKind)
    : ((current?.date_kind as ClubEventDateKind | undefined) ?? 'single')

  const startDate = body.date !== undefined
    ? requireDateString(body.date, 'date')
    : requireDateString(current?.date, 'date')

  let endDate: string | null = null
  if (dateKind === 'range') {
    endDate = body.endDate !== undefined
      ? optionalDateString(body.endDate, 'endDate')
      : (current?.end_date ?? null)
    if (!endDate) serviceError('endDate is required when dateKind is range', 400)
    if (endDate < startDate) serviceError('endDate must be on or after date', 400)
  }

  const imageUrl = body.imageUrl !== undefined ? validateOptionalUrl(body.imageUrl, 'imageUrl') : (current?.image_url ?? null)
  const linkUrl = body.linkUrl !== undefined ? validateOptionalUrl(body.linkUrl, 'linkUrl') : (current?.link_url ?? null)

  return {
    title_es: titleEs,
    title_en: titleEn,
    blurb_es: blurbEs,
    blurb_en: blurbEn,
    description_es: descriptionEs,
    description_en: descriptionEn,
    category_es: categoryEs,
    category_en: categoryEn,
    date_kind: dateKind,
    date: startDate,
    end_date: endDate,
    recurrence_label_es: recurrenceLabelEs,
    recurrence_label_en: recurrenceLabelEn,
    image_url: imageUrl,
    link_url: linkUrl,
    title: titleEs,
    description: null,
    start_time: '00:00:00',
    end_time: '23:59:00',
  }
}

function toAdminClubEvent(row: EventRow, blocks: EventRoomBlockRow[], today: string): AdminClubEvent {
  const roomBlocks: AdminEventRoomBlock[] = blocks.map((b) => ({
    id: b.id,
    roomId: b.room_id,
    date: b.date,
    startTime: b.start_time.slice(0, 5),
    endTime: b.end_time.slice(0, 5),
    allDay: b.all_day,
  }))

  return {
    id: row.id,
    titleEs: row.title_es ?? row.title,
    titleEn: row.title_en ?? row.title,
    blurbEs: row.blurb_es ?? '',
    blurbEn: row.blurb_en ?? '',
    descriptionEs: row.description_es,
    descriptionEn: row.description_en,
    dateKind: (row.date_kind as ClubEventDateKind) ?? 'single',
    startDate: row.date,
    endDate: row.end_date,
    recurrenceLabelEs: row.recurrence_label_es,
    recurrenceLabelEn: row.recurrence_label_en,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    categoryEs: row.category_es,
    categoryEn: row.category_en,
    status: statusFor(row, today),
    blocksRooms: roomBlocks.length > 0,
    roomBlocks,
  }
}

/** Cancel active/pending reservations that overlap a newly-created room block. */
async function cancelConflictingReservations(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  roomId: string,
  date: string,
  startTime: string,
  endTime: string,
): Promise<void> {
  const { data: tables, error: tablesError } = await admin.from('tables').select('id').eq('room_id', roomId)
  if (tablesError) serviceError('Internal server error', 500)

  const tableIds = ((tables ?? []) as { id: string }[]).map((t) => t.id)
  if (tableIds.length === 0) return

  const { error } = await admin
    .from('reservations')
    .update({ status: 'cancelled' })
    .in('table_id', tableIds)
    .eq('date', date)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .in('status', ['active', 'pending'])

  if (error) serviceError('Internal server error', 500)
}

/**
 * Replace all room blocks for a club event: deletes existing blocks, then
 * inserts one row per schedule entry that has a room attached (entries with
 * no room are informational-only and create no block — this is how "room
 * blocking optional" is enforced even when `blocksRooms` is true but a given
 * schedule row has no room selected). Cancels conflicting reservations for
 * every newly-created block, mirroring create_event_with_blocks /
 * update_event_with_blocks in events-service.ts.
 */
async function applyClubEventRoomBlocks(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  eventId: string,
  blocks: NormalisedEventSchedule[],
): Promise<EventRoomBlockRow[]> {
  const { error: deleteError } = await admin.from('event_room_blocks').delete().eq('event_id', eventId)
  if (deleteError) serviceError('Internal server error', 500)

  const inserted: EventRoomBlockRow[] = []
  for (const block of blocks) {
    if (!block.room_id) continue

    const { data, error } = await admin
      .from('event_room_blocks')
      .insert({
        event_id: eventId,
        room_id: block.room_id,
        date: block.date,
        start_time: block.start_time,
        end_time: block.end_time,
        all_day: block.all_day,
      })
      .select('id, event_id, room_id, date, start_time, end_time, all_day')
      .maybeSingle()

    if (error) serviceError('Internal server error', 500)
    if (data) {
      inserted.push(data as EventRoomBlockRow)
      await cancelConflictingReservations(admin, block.room_id, block.date, block.start_time, block.end_time)
    }
  }

  return inserted
}

function validateSchedulesPayload(raw: unknown): NormalisedEventSchedule[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    serviceError('At least one schedule is required when blocksRooms is true', 400)
  }
  if (raw.length > 366) serviceError('Too many schedule blocks', 400)
  return raw.map((s, i) => validateAndNormaliseSchedule(s, i))
}

async function fetchEventRoomBlocks(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  eventId: string,
): Promise<EventRoomBlockRow[]> {
  const { data, error } = await admin
    .from('event_room_blocks')
    .select('id, event_id, room_id, date, start_time, end_time, all_day')
    .eq('event_id', eventId)

  if (error) serviceError('Internal server error', 500)
  return (data ?? []) as EventRoomBlockRow[]
}

/** Admin read of every club event (upcoming + past), including room blocks. */
export async function listAdminClubEvents(session: SessionUser): Promise<AdminListClubEventsResult> {
  requireAdminSession(session)
  const today = getCurrentClubDate()

  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('events')
    .select(ADMIN_CLUB_EVENT_COLUMNS)
    .not('title_es', 'is', null)
    .not('title_en', 'is', null)
    .order('date', { ascending: true })

  if (error) serviceError('Internal server error', 500)

  const rows = (data ?? []) as EventRow[]
  if (rows.length === 0) return { upcoming: [], past: [] }

  const { data: blocks, error: blocksError } = await admin
    .from('event_room_blocks')
    .select('id, event_id, room_id, date, start_time, end_time, all_day')
    .in('event_id', rows.map((r) => r.id))

  if (blocksError) serviceError('Internal server error', 500)

  const blocksByEvent = new Map<string, EventRoomBlockRow[]>()
  for (const block of (blocks ?? []) as EventRoomBlockRow[]) {
    const list = blocksByEvent.get(block.event_id) ?? []
    list.push(block)
    blocksByEvent.set(block.event_id, list)
  }

  const events = rows.map((row) => toAdminClubEvent(row, blocksByEvent.get(row.id) ?? [], today))
  const upcoming = events.filter((event) => event.status === 'upcoming')
  const past = events
    .filter((event) => event.status === 'past')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  return { upcoming, past }
}

export async function createClubEvent(session: SessionUser, body: ClubEventInput): Promise<AdminClubEvent> {
  requireAdminSession(session)

  const fields = resolveClubEventFields(body, null)
  const admin = createSupabaseServerAdminClient()

  const { data, error } = await admin
    .from('events')
    .insert({ ...fields, created_by: session.id })
    .select(ADMIN_CLUB_EVENT_COLUMNS)
    .maybeSingle()

  if (error) {
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
      serviceError('Invalid event data', 400)
    }
    serviceError('Internal server error', 500)
  }
  if (!data) serviceError('Internal server error', 500)

  const row = data as EventRow

  let blocks: EventRoomBlockRow[] = []
  if (parseBooleanFlag(body.blocksRooms)) {
    const schedules = validateSchedulesPayload(body.schedules)
    blocks = await applyClubEventRoomBlocks(admin, row.id, schedules)
  }

  return toAdminClubEvent(row, blocks, getCurrentClubDate())
}

export async function updateClubEvent(session: SessionUser, id: string, body: ClubEventInput): Promise<AdminClubEvent> {
  requireAdminSession(session)

  const admin = createSupabaseServerAdminClient()
  const { data: currentData, error: fetchError } = await admin
    .from('events')
    .select(ADMIN_CLUB_EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (fetchError) serviceError('Internal server error', 500)
  const current = currentData as EventRow | null
  if (!current || !current.title_es || !current.title_en) serviceError('Club event not found', 404)

  const fields = resolveClubEventFields(body, current)

  const { data, error } = await admin
    .from('events')
    .update(fields)
    .eq('id', id)
    .select(ADMIN_CLUB_EVENT_COLUMNS)
    .maybeSingle()

  if (error) {
    const pgCode = (error as { code?: string }).code
    if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
      serviceError('Invalid event data', 400)
    }
    serviceError('Internal server error', 500)
  }
  if (!data) serviceError('Club event not found', 404)

  const row = data as EventRow

  let blocks: EventRoomBlockRow[]
  const blocksRoomsProvided = body.blocksRooms !== undefined
  const schedulesProvided = body.schedules !== undefined
  const wantsBlocks = blocksRoomsProvided ? parseBooleanFlag(body.blocksRooms) : undefined

  if (wantsBlocks === false) {
    // Explicit opt-out: remove any existing room blocks for this event.
    const { error: deleteError } = await admin.from('event_room_blocks').delete().eq('event_id', id)
    if (deleteError) serviceError('Internal server error', 500)
    blocks = []
  } else if (schedulesProvided) {
    const schedules = validateSchedulesPayload(body.schedules)
    blocks = await applyClubEventRoomBlocks(admin, id, schedules)
  } else {
    // Neither blocksRooms nor schedules provided — leave existing blocks untouched.
    blocks = await fetchEventRoomBlocks(admin, id)
  }

  return toAdminClubEvent(row, blocks, getCurrentClubDate())
}

export async function deleteClubEvent(session: SessionUser, id: string): Promise<void> {
  requireAdminSession(session)

  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('events')
    .select('id, title_es, title_en')
    .eq('id', id)
    .maybeSingle()

  if (error) serviceError('Internal server error', 500)
  const row = data as Pick<EventRow, 'id' | 'title_es' | 'title_en'> | null
  if (!row || !row.title_es || !row.title_en) serviceError('Club event not found', 404)

  // Reuse the internal delete flow: cancels overlapping reservations for any
  // attached room blocks, then removes the row (and its blocks, via FK
  // cascade) — same behavior as deleting a room-booking event today.
  await deleteEvent(id)
}
