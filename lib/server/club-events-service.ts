import 'server-only'
import type {
  AdminClubEvent,
  AdminEventMaterial,
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
  /**
   * OIR-208: unified events. ON (default for new events) writes the
   * bilingual landing columns (title_es/title_en, ...) so the event
   * publishes on the landing; OFF stores title_es/title_en as NULL (paired
   * constraint holds) and keeps the Spanish title in the legacy `title`
   * column only — an internal-only event. Toggling this on an update
   * converts the row in place.
   */
  visibleOnLanding?: unknown
  /** Materials (equipment) needed for the event; replace-set on every save. */
  materials?: unknown
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

/**
 * OIR-206: English copy is optional everywhere — when the admin leaves an
 * `*En` field blank, fall back to the paired `*Es` value so DB NOT NULL /
 * paired constraints (`events_bilingual_titles_paired`) stay satisfied and
 * the landing still renders content in the EN locale.
 *
 * Resolution rules (explicit, in priority order):
 * 1. `enProvided` and the trimmed value is non-empty → use it verbatim.
 * 2. `enProvided` and the trimmed value is empty → treat blanking as
 *    "re-enable auto-copy": return the (new) ES value.
 * 3. Not provided (`undefined`) → preserve `current.en` if it exists and
 *    differs from the OLD ES value (a deliberate edit); if `current.en`
 *    equals the OLD ES value (or there is no current row), auto-copy the
 *    new ES value.
 *
 * Rule 3's "identical EN === ES" auto-copy heuristic is safe because our
 * admin forms always resend every field: a deliberately identical EN is
 * resent explicitly on every update and is preserved by rule 1, so it never
 * falls into rule 3's heuristic path.
 */
function resolveBilingualEnFallback(
  field: string,
  esValue: string | null,
  rawEn: unknown,
  enProvided: boolean,
  current: { es: string | null; en: string | null } | null,
): string | null {
  if (enProvided) {
    // Finding 5 (mirrors optionalString): a non-string, non-null value (an
    // array, object, number…) must be rejected rather than silently treated
    // as "absent" and falling back to the ES value.
    if (rawEn !== null && typeof rawEn !== 'string') {
      serviceError(`${field} must be a string`, 400)
    }
    const trimmed = typeof rawEn === 'string' ? rawEn.trim() : ''
    return trimmed !== '' ? trimmed : esValue
  }
  if (!current) return esValue
  const wasAutoCopied = current.en === current.es
  return wasAutoCopied ? esValue : current.en
}

interface ClubEventFieldSet {
  // OIR-208: null when visibleOnLanding is false (internal-only event) — the
  // paired-titles CHECK constraint holds since both are nulled together.
  title_es: string | null
  title_en: string | null
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
  // OIR-208: current.title_es is NULL for internal-only events — fall back
  // to the legacy `title` column (same convention as the read-side mappers)
  // so editing an internal event without resending titleEs doesn't 400.
  const titleEs = body.titleEs !== undefined
    ? requireNonEmptyString(body.titleEs, 'titleEs')
    : requireNonEmptyString(current ? (current.title_es ?? current.title) : null, 'titleEs')
  // OIR-206: titleEn is optional — falls back to titleEs (see
  // resolveBilingualEnFallback) rather than being required client- or
  // service-side. `?? titleEs` is a type-level safety net only; in practice
  // the fallback never returns null here because titleEs is always a
  // non-empty string.
  const titleEn = resolveBilingualEnFallback(
    'titleEn',
    titleEs,
    body.titleEn,
    body.titleEn !== undefined,
    current ? { es: current.title_es, en: current.title_en } : null,
  ) ?? titleEs

  const blurbEs = body.blurbEs !== undefined ? optionalString(body.blurbEs, 'blurbEs') : (current?.blurb_es ?? null)
  const blurbEn = resolveBilingualEnFallback(
    'blurbEn',
    blurbEs,
    body.blurbEn,
    body.blurbEn !== undefined,
    current ? { es: current.blurb_es, en: current.blurb_en } : null,
  )
  const descriptionEs = body.descriptionEs !== undefined ? optionalString(body.descriptionEs, 'descriptionEs') : (current?.description_es ?? null)
  const descriptionEn = resolveBilingualEnFallback(
    'descriptionEn',
    descriptionEs,
    body.descriptionEn,
    body.descriptionEn !== undefined,
    current ? { es: current.description_es, en: current.description_en } : null,
  )
  const categoryEs = body.categoryEs !== undefined ? optionalString(body.categoryEs, 'categoryEs') : (current?.category_es ?? null)
  const categoryEn = resolveBilingualEnFallback(
    'categoryEn',
    categoryEs,
    body.categoryEn,
    body.categoryEn !== undefined,
    current ? { es: current.category_es, en: current.category_en } : null,
  )
  const recurrenceLabelEs = body.recurrenceLabelEs !== undefined
    ? optionalString(body.recurrenceLabelEs, 'recurrenceLabelEs')
    : (current?.recurrence_label_es ?? null)
  const recurrenceLabelEn = resolveBilingualEnFallback(
    'recurrenceLabelEn',
    recurrenceLabelEs,
    body.recurrenceLabelEn,
    body.recurrenceLabelEn !== undefined,
    current ? { es: current.recurrence_label_es, en: current.recurrence_label_en } : null,
  )

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

  // OIR-208: ON (default for new events) publishes the bilingual columns;
  // OFF nulls them (paired constraint holds) and keeps only the legacy
  // `title` column populated — an internal-only event. When omitted on an
  // update, preserve whatever the row currently is.
  const visibleOnLanding = body.visibleOnLanding !== undefined
    ? parseBooleanFlag(body.visibleOnLanding)
    : (current ? isClubEventRow(current) : true)

  return {
    title_es: visibleOnLanding ? titleEs : null,
    title_en: visibleOnLanding ? titleEn : null,
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

function toAdminClubEvent(
  row: EventRow,
  blocks: EventRoomBlockRow[],
  materials: AdminEventMaterial[],
  today: string,
): AdminClubEvent {
  const roomBlocks: AdminEventRoomBlock[] = blocks.map((b) => ({
    id: b.id,
    roomId: b.room_id,
    tableId: b.table_id ?? null,
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
    // OIR-208: unified events — a row is landing-visible once both bilingual
    // titles are populated (same predicate as isClubEventRow).
    visibleOnLanding: isClubEventRow(row),
    materials,
  }
}

/**
 * Replace room blocks and/or materials for a club event via the atomic
 * `apply_club_event_room_blocks` SECURITY DEFINER RPC (Finding 1 — replaces
 * the previous non-transactional delete-all → per-block insert → per-block
 * reservation-cancel JS loop). In one DB transaction: deletes existing
 * blocks for the event, inserts one row per schedule entry that has a room
 * attached (entries with no room are informational-only and create no block
 * — this is how "room blocking optional" is enforced even when
 * `blocksRooms` is true but a given schedule row has no room selected), and
 * cancels overlapping active/pending reservations for every newly-created
 * block using the same overlap predicate as `update_event_with_blocks` —
 * scoped to a single table when the block carries a `table_id` (OIR-208),
 * or the whole room when it doesn't (unchanged behavior). Materials
 * (event_equipment) are replaced the same way.
 *
 * `blocks`/`materials` of `null` leaves the corresponding rows untouched
 * (the RPC skips that section entirely) — used when a save only changes
 * the other axis. An array (including `[]`) fully replaces it.
 */
async function applyClubEventRoomBlocksAndMaterials(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  eventId: string,
  blocks: NormalisedEventSchedule[] | null,
  materials: NormalisedMaterial[] | null,
): Promise<EventRoomBlockRow[]> {
  const blocksPayload = blocks === null
    ? null
    : blocks
      .filter((b) => b.room_id)
      .map((b) => ({
        room_id: b.room_id,
        table_id: b.table_id,
        date: b.date,
        all_day: b.all_day,
        start_time: b.start_time,
        end_time: b.end_time,
      }))

  const materialsPayload = materials === null
    ? null
    : materials.map((m) => ({ equipment_id: m.equipment_id, quantity: m.quantity }))

  const { data, error } = await admin.rpc('apply_club_event_room_blocks', {
    p_event_id: eventId,
    p_blocks: blocksPayload,
    p_materials: materialsPayload,
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

  const blockKey = (b: { room_id: string; table_id?: string | null; date: string; all_day: boolean; start_time: string; end_time: string }) =>
    `${b.room_id}|${b.table_id ?? ''}|${b.date}|${b.all_day}|${b.start_time.slice(0, 5)}|${b.end_time.slice(0, 5)}`

  const currentKeys = current.map((b) => blockKey(b)).sort()
  const incomingKeys = incomingWithRoom.map((s) => blockKey(s)).sort()

  return currentKeys.every((key, i) => key === incomingKeys[i])
}

/** OIR-208: one validated {equipment_id, quantity} entry for an event's materials. */
interface NormalisedMaterial {
  equipment_id: string
  quantity: number
}

const MAX_EVENT_MATERIALS = 100

/** `undefined` means "materials not provided" and resolves to an empty set. */
function validateMaterialsPayload(raw: unknown): NormalisedMaterial[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) serviceError('materials must be an array', 400)
  if (raw.length > MAX_EVENT_MATERIALS) serviceError('Too many materials', 400)

  const seen = new Set<string>()
  return raw.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      serviceError(`materials[${index}] must be an object`, 400)
    }
    const item = entry as Record<string, unknown>
    const equipmentId = typeof item.equipmentId === 'string' ? item.equipmentId.trim() : ''
    if (!equipmentId) serviceError(`materials[${index}].equipmentId is required`, 400)
    if (seen.has(equipmentId)) serviceError(`materials[${index}].equipmentId is duplicated`, 400)
    seen.add(equipmentId)

    const rawQuantity = item.quantity
    const quantity = rawQuantity === undefined || rawQuantity === null ? 1 : Number(rawQuantity)
    if (!Number.isInteger(quantity) || quantity < 1) {
      serviceError(`materials[${index}].quantity must be a positive integer`, 400)
    }

    return { equipment_id: equipmentId, quantity }
  })
}

type EventEquipmentJoinRow = {
  event_id: string
  equipment_id: string
  quantity: number
  equipment: { id: string; name: string } | null
}

async function fetchEventMaterials(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  eventId: string,
): Promise<AdminEventMaterial[]> {
  const { data, error } = await admin
    .from('event_equipment')
    .select('event_id, equipment_id, quantity, equipment(id, name)')
    .eq('event_id', eventId)

  if (error) serviceError('Internal server error', 500)

  return ((data ?? []) as unknown as EventEquipmentJoinRow[])
    .filter((row) => row.equipment !== null)
    .map((row) => ({
      equipmentId: row.equipment_id,
      name: (row.equipment as { id: string; name: string }).name,
      quantity: row.quantity,
    }))
}

async function fetchEventMaterialsForMany(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  eventIds: string[],
): Promise<Map<string, AdminEventMaterial[]>> {
  const byEvent = new Map<string, AdminEventMaterial[]>()
  if (eventIds.length === 0) return byEvent

  const { data, error } = await admin
    .from('event_equipment')
    .select('event_id, equipment_id, quantity, equipment(id, name)')
    .in('event_id', eventIds)

  if (error) serviceError('Internal server error', 500)

  for (const row of (data ?? []) as unknown as EventEquipmentJoinRow[]) {
    if (!row.equipment) continue
    const list = byEvent.get(row.event_id) ?? []
    list.push({ equipmentId: row.equipment_id, name: row.equipment.name, quantity: row.quantity })
    byEvent.set(row.event_id, list)
  }
  return byEvent
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
    .select('id, event_id, room_id, table_id, date, start_time, end_time, all_day')
    .eq('event_id', eventId)

  if (error) serviceError('Internal server error', 500)
  return (data ?? []) as EventRoomBlockRow[]
}

/**
 * Admin read of EVERY event (upcoming + past), landing-published or
 * internal-only, including room blocks and materials (OIR-208: the
 * dashboard's unified "Eventos" section shows every row, with a "Landing"
 * badge on published ones — see AdminClubEvent.visibleOnLanding).
 */
export async function listAdminClubEvents(session: SessionUser): Promise<AdminListClubEventsResult> {
  requireAdminSession(session)
  const today = getCurrentClubDate()

  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('events')
    .select(ADMIN_CLUB_EVENT_COLUMNS)
    .order('date', { ascending: true })

  if (error) serviceError('Internal server error', 500)

  const rows = (data ?? []) as EventRow[]
  if (rows.length === 0) return { upcoming: [], past: [] }

  const eventIds = rows.map((r) => r.id)

  const { data: blocks, error: blocksError } = await admin
    .from('event_room_blocks')
    .select('id, event_id, room_id, table_id, date, start_time, end_time, all_day')
    .in('event_id', eventIds)

  if (blocksError) serviceError('Internal server error', 500)

  const blocksByEvent = new Map<string, EventRoomBlockRow[]>()
  for (const block of (blocks ?? []) as EventRoomBlockRow[]) {
    const list = blocksByEvent.get(block.event_id) ?? []
    list.push(block)
    blocksByEvent.set(block.event_id, list)
  }

  const materialsByEvent = await fetchEventMaterialsForMany(admin, eventIds)

  const events = rows.map((row) => toAdminClubEvent(
    row,
    blocksByEvent.get(row.id) ?? [],
    materialsByEvent.get(row.id) ?? [],
    today,
  ))
  const upcoming = events.filter((event) => event.status === 'upcoming')
  const past = events
    .filter((event) => event.status === 'past')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  return { upcoming, past }
}

export async function createClubEvent(session: SessionUser, body: ClubEventInput): Promise<AdminClubEvent> {
  requireAdminSession(session)

  // Finding 2: validate EVERYTHING — fields, URL allowlist, and (when
  // blocksRooms/materials are set) their payloads — before any DB write.
  const fields = resolveClubEventFields(body, null)
  const wantsBlocks = parseBooleanFlag(body.blocksRooms)
  const schedules = wantsBlocks ? validateSchedulesPayload(body.schedules) : null
  const materials = validateMaterialsPayload(body.materials)

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
  if (schedules || materials.length > 0) {
    blocks = await applyClubEventRoomBlocksAndMaterials(admin, row.id, schedules, materials.length > 0 ? materials : null)
  }
  const eventMaterials = materials.length > 0 ? await fetchEventMaterials(admin, row.id) : []

  return toAdminClubEvent(row, blocks, eventMaterials, getCurrentClubDate())
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
  // OIR-208: the unified service operates on ANY event row (landing or
  // internal) — the isClubEventRow guard from OIR-203 is superseded here.
  // The legacy /api/events/[id] endpoints (lib/server/events-service.ts)
  // keep their own isClubEventRow guard so old clients can't touch these rows.
  if (!current) serviceError('Club event not found', 404)

  // Finding 2: validate EVERYTHING — fields, URL allowlist, and (when
  // applicable) the schedules/materials payloads — before any DB write
  // (UPDATE below).
  const fields = resolveClubEventFields(body, current)

  const blocksRoomsProvided = body.blocksRooms !== undefined
  const schedulesProvided = body.schedules !== undefined
  const wantsBlocks = blocksRoomsProvided ? parseBooleanFlag(body.blocksRooms) : undefined

  const validatedSchedules = wantsBlocks !== false && schedulesProvided
    ? validateSchedulesPayload(body.schedules)
    : null

  const materialsProvided = body.materials !== undefined
  const validatedMaterials = materialsProvided ? validateMaterialsPayload(body.materials) : null

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

  // `blocksParam` of null means "leave existing blocks untouched" — passed
  // straight through to applyClubEventRoomBlocksAndMaterials, which skips
  // touching event_room_blocks entirely for that value.
  let blocksParam: NormalisedEventSchedule[] | null = null
  let cachedCurrentBlocks: EventRoomBlockRow[] | null = null

  if (wantsBlocks === false) {
    // Explicit opt-out: clear any existing room blocks for this event.
    blocksParam = []
  } else if (validatedSchedules) {
    // Finding 4: skip the (now atomic, but still non-free) block-replace RPC
    // entirely when the incoming schedules are identical to what's already
    // stored — metadata-only edits (title/blurb/etc) always resend the
    // current schedules from the edit form, so this avoids needless churn.
    cachedCurrentBlocks = await fetchEventRoomBlocks(admin, id)
    blocksParam = blocksMatchSchedules(cachedCurrentBlocks, validatedSchedules) ? null : validatedSchedules
  }
  // else: neither blocksRooms nor schedules provided — blocksParam stays
  // null (leave existing blocks untouched).

  const materialsParam = validatedMaterials

  let blocks: EventRoomBlockRow[]
  if (blocksParam !== null || materialsParam !== null) {
    blocks = await applyClubEventRoomBlocksAndMaterials(admin, id, blocksParam, materialsParam)
  } else {
    blocks = cachedCurrentBlocks ?? await fetchEventRoomBlocks(admin, id)
  }

  const eventMaterials = await fetchEventMaterials(admin, id)

  return toAdminClubEvent(row, blocks, eventMaterials, getCurrentClubDate())
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
  // OIR-208: the unified service operates on ANY event row (landing or
  // internal) — the isClubEventRow guard from OIR-203 is superseded here.
  if (!row) serviceError('Club event not found', 404)

  // Reuse the internal delete flow: cancels overlapping reservations for any
  // attached room blocks, then removes the row (and its blocks/materials, via
  // FK cascade) — same behavior as deleting a room-booking event today.
  // Calls deleteEventCascade directly (not the guarded deleteEvent) since
  // this surface intentionally operates on any row — the inverse of
  // deleteEvent's own isClubEventRow guard.
  await deleteEventCascade(admin, id)
}
