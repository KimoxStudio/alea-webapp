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
import {
  deleteEventCascade,
  isClubEventRow,
  validateAndNormaliseSchedule,
  type NormalisedEventSchedule,
} from '@/lib/server/events-service'
import { validateOptionalUrl } from '@/lib/validations/url'

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

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  // Finding 5: mirror requireNonEmptyString's typeof guard — a non-string,
  // non-null value (e.g. `{}`, `[]`, a number) must be rejected rather than
  // silently coerced via String(value), which would persist "[object
  // Object]" or similar garbage into the row.
  if (typeof value !== 'string') serviceError(`${field} must be a string`, 400)
  const str = value.trim()
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

  const blurbEs = body.blurbEs !== undefined ? optionalString(body.blurbEs, 'blurbEs') : (current?.blurb_es ?? null)
  const blurbEn = body.blurbEn !== undefined ? optionalString(body.blurbEn, 'blurbEn') : (current?.blurb_en ?? null)
  const descriptionEs = body.descriptionEs !== undefined ? optionalString(body.descriptionEs, 'descriptionEs') : (current?.description_es ?? null)
  const descriptionEn = body.descriptionEn !== undefined ? optionalString(body.descriptionEn, 'descriptionEn') : (current?.description_en ?? null)
  const categoryEs = body.categoryEs !== undefined ? optionalString(body.categoryEs, 'categoryEs') : (current?.category_es ?? null)
  const categoryEn = body.categoryEn !== undefined ? optionalString(body.categoryEn, 'categoryEn') : (current?.category_en ?? null)
  const recurrenceLabelEs = body.recurrenceLabelEs !== undefined
    ? optionalString(body.recurrenceLabelEs, 'recurrenceLabelEs')
    : (current?.recurrence_label_es ?? null)
  const recurrenceLabelEn = body.recurrenceLabelEn !== undefined
    ? optionalString(body.recurrenceLabelEn, 'recurrenceLabelEn')
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

/**
 * Replace all room blocks for a club event via the atomic
 * `apply_club_event_room_blocks` SECURITY DEFINER RPC (Finding 1 — replaces
 * the previous non-transactional delete-all → per-block insert → per-block
 * reservation-cancel JS loop). In one DB transaction: deletes existing
 * blocks for the event, inserts one row per schedule entry that has a room
 * attached (entries with no room are informational-only and create no block
 * — this is how "room blocking optional" is enforced even when
 * `blocksRooms` is true but a given schedule row has no room selected), and
 * cancels overlapping active/pending reservations for every newly-created
 * block using the same overlap predicate as `update_event_with_blocks`.
 */
async function applyClubEventRoomBlocks(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  eventId: string,
  blocks: NormalisedEventSchedule[],
): Promise<EventRoomBlockRow[]> {
  const blocksPayload = blocks
    .filter((b) => b.room_id)
    .map((b) => ({
      room_id: b.room_id,
      date: b.date,
      all_day: b.all_day,
      start_time: b.start_time,
      end_time: b.end_time,
    }))

  const { data, error } = await admin.rpc('apply_club_event_room_blocks', {
    p_event_id: eventId,
    p_blocks: blocksPayload,
  })

  if (error) {
    const pgCode = (error as { code?: string }).code
    if (pgCode === 'P0001') {
      serviceError('Club event not found', 404)
    }
    if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
      serviceError('Invalid event data', 400)
    }
    serviceError('Internal server error', 500)
  }

  return (data ?? []) as EventRoomBlockRow[]
}

/**
 * Order-insensitive comparison of the currently-stored room blocks against
 * an incoming (already-validated) schedules payload — used by Finding 4 to
 * skip the block-replace RPC entirely when a save carries no actual block
 * changes (e.g. a metadata-only edit that always resends the current
 * schedules from the edit form).
 */
function blocksMatchSchedules(current: EventRoomBlockRow[], incoming: NormalisedEventSchedule[]): boolean {
  const incomingWithRoom = incoming.filter((s): s is NormalisedEventSchedule & { room_id: string } => !!s.room_id)
  if (current.length !== incomingWithRoom.length) return false

  const blockKey = (b: { room_id: string; date: string; all_day: boolean; start_time: string; end_time: string }) =>
    `${b.room_id}|${b.date}|${b.all_day}|${b.start_time.slice(0, 5)}|${b.end_time.slice(0, 5)}`

  const currentKeys = current.map((b) => blockKey(b)).sort()
  const incomingKeys = incomingWithRoom.map((s) => blockKey(s)).sort()

  return currentKeys.every((key, i) => key === incomingKeys[i])
}

function validateSchedulesPayload(raw: unknown): NormalisedEventSchedule[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    serviceError('At least one schedule is required when blocksRooms is true', 400)
  }
  if (raw.length > 366) serviceError('Too many schedule blocks', 400)
  return raw.map((s, i) => validateAndNormaliseSchedule(s, i))
}

/**
 * Validate that every room referenced by an incoming schedules payload
 * actually exists, BEFORE any write to the "events" table (PR #149 review).
 * Creating the event row before calling the apply_club_event_room_blocks RPC
 * could otherwise leave an orphaned club event behind if the RPC failed
 * (bad room id, FK issue, transient DB error) — rejecting unknown room ids
 * up front removes the most common failure cause before the insert ever
 * happens. The try/catch rollback in createClubEvent still guards against
 * any other RPC failure (e.g. transient errors) so the "no orphan event row"
 * invariant holds unconditionally, not just for bad-room-id cases.
 */
async function validateRoomsExist(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  schedules: NormalisedEventSchedule[],
): Promise<void> {
  const roomIds = Array.from(new Set(schedules.map((s) => s.room_id).filter((id): id is string => !!id)))
  if (roomIds.length === 0) return

  const { data, error } = await admin.from('rooms').select('id').in('id', roomIds)
  if (error) serviceError('Internal server error', 500)

  const foundIds = new Set((data ?? []).map((r) => (r as { id: string }).id))
  const missing = roomIds.filter((id) => !foundIds.has(id))
  if (missing.length > 0) serviceError('Invalid room id in schedules', 400)
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

  // Finding 2: validate EVERYTHING — fields, URL allowlist, and (when
  // blocksRooms is set) the schedules payload — before any DB write.
  const fields = resolveClubEventFields(body, null)
  const wantsBlocks = parseBooleanFlag(body.blocksRooms)
  const schedules = wantsBlocks ? validateSchedulesPayload(body.schedules) : null

  const admin = createSupabaseServerAdminClient()

  // PR #149 review: validate every referenced room exists BEFORE the event
  // insert, so the most common cause of a post-insert block-RPC failure
  // (an invalid room id) is rejected up front instead of leaving an orphan
  // "events" row.
  if (schedules) {
    await validateRoomsExist(admin, schedules)
  }

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
  if (schedules) {
    try {
      blocks = await applyClubEventRoomBlocks(admin, row.id, schedules)
    } catch (err) {
      // Compensating delete (PR #149 review): the block-replacement RPC
      // failed after the event row was already inserted (validated room ids
      // notwithstanding — e.g. a transient DB error). Remove the now-orphaned
      // row so a failed create never leaves a partial club event behind, then
      // rethrow the original error (preserves its status code/message).
      const { error: compensatingDeleteError } = await admin.from('events').delete().eq('id', row.id)
      if (compensatingDeleteError) {
        // PR #149 review (round 2): if the compensating delete itself fails,
        // the client still sees the original RPC error (500) below, but a
        // fully public, un-blocked event row would otherwise silently persist
        // with no room blocks and no visibility for ops. Log it loudly so the
        // orphaned row can be found and cleaned up manually.
        console.error(
          '[club-events] compensating delete failed after apply_club_event_room_blocks error — orphaned event row requires manual cleanup:',
          row.id,
        )
      }
      throw err
    }
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
  if (!current || !isClubEventRow(current)) serviceError('Club event not found', 404)

  // Finding 2: validate EVERYTHING — fields, URL allowlist, and (when
  // applicable) the schedules payload — before any DB write (UPDATE below).
  const fields = resolveClubEventFields(body, current)

  const blocksRoomsProvided = body.blocksRooms !== undefined
  const schedulesProvided = body.schedules !== undefined
  const wantsBlocks = blocksRoomsProvided ? parseBooleanFlag(body.blocksRooms) : undefined

  const validatedSchedules = wantsBlocks !== false && schedulesProvided
    ? validateSchedulesPayload(body.schedules)
    : null

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

  if (wantsBlocks === false) {
    // Explicit opt-out: remove any existing room blocks for this event.
    const { error: deleteError } = await admin.from('event_room_blocks').delete().eq('event_id', id)
    if (deleteError) serviceError('Internal server error', 500)
    blocks = []
  } else if (validatedSchedules) {
    // Finding 4: skip the (now atomic, but still non-free) block-replace RPC
    // entirely when the incoming schedules are identical to what's already
    // stored — metadata-only edits (title/blurb/etc) always resend the
    // current schedules from the edit form, so this avoids needless churn.
    const currentBlocks = await fetchEventRoomBlocks(admin, id)
    blocks = blocksMatchSchedules(currentBlocks, validatedSchedules)
      ? currentBlocks
      : await applyClubEventRoomBlocks(admin, id, validatedSchedules)
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
  if (!row || !isClubEventRow(row)) serviceError('Club event not found', 404)

  // Reuse the internal delete flow: cancels overlapping reservations for any
  // attached room blocks, then removes the row (and its blocks, via FK
  // cascade) — same behavior as deleting a room-booking event today. Calls
  // deleteEventCascade directly (not the guarded deleteEvent) since we've
  // already validated this row IS a club event above — the inverse of
  // deleteEvent's own isClubEventRow guard.
  await deleteEventCascade(admin, id)
}
