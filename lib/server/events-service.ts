import 'server-only'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'
import type { AdminEvent, AdminEventRoomBlock, AdminEventSchedule } from '@/lib/types'

export type { AdminEvent, AdminEventRoomBlock, AdminEventSchedule }

type EventRow = Tables<'events'>
type EventRoomBlockRow = Tables<'event_room_blocks'>

// ---------------------------------------------------------------------------
// Shared "is this a club-event (landing) row?" predicate (OIR-203 code
// review, Finding 3). A row becomes public landing content once BOTH
// title_es and title_en are populated (see lib/server/club-events-service.ts).
// Every legacy internal room-booking entry point (updateEvent, deleteEvent,
// and listEvents' `.or('title_es.is.null,title_en.is.null')` filter) must
// treat such rows as out of scope for this surface — they are owned
// exclusively by the "Club events" admin flow.
// ---------------------------------------------------------------------------
export function isClubEventRow(row: Pick<EventRow, 'title_es' | 'title_en'>): boolean {
  return row.title_es != null && row.title_en != null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const WHOLE_HOUR_TIME_RE = /^([01]\d|2[0-3]):00$/

function validateDateTimeFields(date: string, startTime: string, endTime: string): void {
  if (!DATE_RE.test(date)) serviceError('date must be in YYYY-MM-DD format', 400)
  if (!TIME_RE.test(startTime)) serviceError('startTime must be in HH:MM format', 400)
  if (!TIME_RE.test(endTime)) serviceError('endTime must be in HH:MM format', 400)
  if (!WHOLE_HOUR_TIME_RE.test(startTime)) serviceError('startTime must be on a whole-hour boundary', 400)
  if (!WHOLE_HOUR_TIME_RE.test(endTime)) serviceError('endTime must be on a whole-hour boundary', 400)
  if (endTime <= startTime) serviceError('endTime must be after startTime', 400)
}

function parseAllDay(value: unknown): boolean {
  return value === true || value === 'true'
}

function resolveBlockTimes(date: string, startTime: string, endTime: string, allDay: boolean) {
  if (!DATE_RE.test(date)) serviceError('date must be in YYYY-MM-DD format', 400)
  if (allDay) {
    return { startTime: '00:00', endTime: '23:59' }
  }

  validateDateTimeFields(date, startTime, endTime)
  return { startTime, endTime }
}

/** Derive the earliest (date, start_time, end_time) from a block list for the event anchor columns */
function deriveAnchor(blocks: EventRoomBlockRow[]): { date: string; startTime: string; endTime: string } {
  if (blocks.length === 0) return { date: '', startTime: '00:00', endTime: '00:00' }
  const sorted = [...blocks].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    return d !== 0 ? d : a.start_time.localeCompare(b.start_time)
  })
  const first = sorted[0]
  return {
    date: first.date,
    startTime: first.start_time.slice(0, 5),
    endTime: first.end_time.slice(0, 5),
  }
}

function toAdminEvent(row: EventRow, blocks: EventRoomBlockRow[]): AdminEvent {
  const anchor = blocks.length > 0 ? deriveAnchor(blocks) : {
    date: row.date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
  }
  const inferredAllDay = anchor.startTime === '00:00' && anchor.endTime === '23:59'

  const roomBlocks: AdminEventRoomBlock[] = blocks.map((b) => ({
    id: b.id,
    roomId: b.room_id,
    date: b.date,
    startTime: b.start_time.slice(0, 5),
    endTime: b.end_time.slice(0, 5),
    allDay: b.all_day,
  }))

  const rawSchedules: AdminEventSchedule[] = blocks.map((b) => ({
    id: b.id,
    roomId: b.room_id,
    date: b.date,
    startTime: b.start_time.slice(0, 5),
    endTime: b.end_time.slice(0, 5),
    allDay: b.all_day,
  }))

  // Sort schedules chronologically ascending (date, then startTime)
  const schedules = [...rawSchedules].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    return d !== 0 ? d : a.startTime.localeCompare(b.startTime)
  })

  // If no blocks exist, synthesize one entry from the event anchor so edit pre-fill works
  if (schedules.length === 0) {
    schedules.push({
      id: undefined,
      roomId: null,
      date: anchor.date,
      startTime: anchor.startTime,
      endTime: anchor.endTime,
      allDay: inferredAllDay,
    })
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: anchor.date,
    startTime: anchor.startTime,
    endTime: anchor.endTime,
    createdBy: row.created_by,
    createdAt: row.created_at,
    roomBlocks,
    schedules,
    allDay: blocks.some((b) => b.all_day) || inferredAllDay,
  }
}

function jsonBlockToSchedule(b: Record<string, unknown>): AdminEventSchedule {
  return {
    id: b.id != null ? String(b.id) : undefined,
    roomId: b.room_id != null ? String(b.room_id) : null,
    date: String(b.date),
    startTime: String(b.start_time).slice(0, 5),
    endTime: String(b.end_time).slice(0, 5),
    allDay: Boolean(b.all_day),
  }
}

function jsonToAdminEvent(obj: Record<string, unknown>): AdminEvent {
  const rawBlocks = Array.isArray(obj.room_blocks) ? obj.room_blocks : []
  const rawSchedules: AdminEventSchedule[] = rawBlocks.map((b: unknown) =>
    jsonBlockToSchedule(b as Record<string, unknown>)
  )
  const roomBlocks: AdminEventRoomBlock[] = rawBlocks
    .filter((b: unknown) => (b as Record<string, unknown>).room_id != null)
    .map((b: unknown) => {
      const block = b as Record<string, unknown>
      return {
        id: String(block.id),
        roomId: String(block.room_id),
        date: String(block.date),
        startTime: String(block.start_time).slice(0, 5),
        endTime: String(block.end_time).slice(0, 5),
        allDay: Boolean(block.all_day),
      }
    })

  // Derive anchor from blocks if present, otherwise fall back to event row fields
  let anchorDate = String(obj.date)
  let anchorStart = String(obj.start_time).slice(0, 5)
  let anchorEnd = String(obj.end_time).slice(0, 5)

  // Sort schedules chronologically ascending (date, then startTime)
  const schedules = [...rawSchedules].sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    return d !== 0 ? d : a.startTime.localeCompare(b.startTime)
  })

  if (schedules.length > 0) {
    anchorDate = schedules[0].date
    anchorStart = schedules[0].startTime
    anchorEnd = schedules[0].endTime
  }

  const inferredAllDay = anchorStart === '00:00' && anchorEnd === '23:59'

  // If no blocks exist, synthesize one entry from the event anchor so edit pre-fill works
  if (schedules.length === 0) {
    schedules.push({
      id: undefined,
      roomId: null,
      date: anchorDate,
      startTime: anchorStart,
      endTime: anchorEnd,
      allDay: inferredAllDay,
    })
  }

  return {
    id: String(obj.id),
    title: String(obj.title),
    description: obj.description != null ? String(obj.description) : null,
    date: anchorDate,
    startTime: anchorStart,
    endTime: anchorEnd,
    createdBy: obj.created_by != null ? String(obj.created_by) : null,
    createdAt: String(obj.created_at),
    roomBlocks,
    schedules,
    allDay: schedules.some((s) => s.allDay) || inferredAllDay,
  }
}

// ---------------------------------------------------------------------------
// Validate a raw schedule payload element and return normalised block
//
// Exported so lib/server/club-events-service.ts (OIR-203) can reuse the same
// validation for the public club-event "blocks rooms" sub-flow instead of
// duplicating date/time parsing rules.
// ---------------------------------------------------------------------------
export interface NormalisedEventSchedule {
  room_id: string | null
  date: string
  start_time: string
  end_time: string
  all_day: boolean
}

export function validateAndNormaliseSchedule(
  raw: unknown,
  index: number,
): NormalisedEventSchedule {
  if (typeof raw !== 'object' || raw === null) {
    serviceError(`schedules[${index}] must be an object`, 400)
  }
  const s = raw as Record<string, unknown>
  const date = String(s.date ?? '').trim()
  const allDay = parseAllDay(s.allDay)
  const rawStart = String(s.startTime ?? '').trim()
  const rawEnd = String(s.endTime ?? '').trim()
  const resolved = resolveBlockTimes(date, rawStart, rawEnd, allDay)
  const roomId = s.roomId ? String(s.roomId).trim() : null

  return {
    room_id: roomId,
    date,
    start_time: resolved.startTime,
    end_time: resolved.endTime,
    all_day: allDay,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listEvents(): Promise<AdminEvent[]> {
  const supabase = await createSupabaseServerClient()
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, title, description, date, start_time, end_time, created_by, created_at')
    // Exclude public "club event" landing rows (OIR-203): a row becomes
    // landing content once both bilingual titles are populated (see
    // lib/server/club-events-service.ts). Those are managed exclusively via
    // the dedicated "Club events" dashboard section, not this legacy
    // internal room-booking view.
    .or('title_es.is.null,title_en.is.null')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (eventsError) serviceError('Internal server error', 500)

  const rows = (events ?? []) as EventRow[]
  if (rows.length === 0) return []

  const admin = createSupabaseServerAdminClient()
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

  return rows.map((row) => toAdminEvent(row, blocksByEvent.get(row.id) ?? []))
}

export async function getEvent(id: string): Promise<AdminEvent> {
  const supabase = await createSupabaseServerClient()
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, description, date, start_time, end_time, created_by, created_at')
    .eq('id', id)
    .maybeSingle()

  if (eventError) serviceError('Internal server error', 500)
  if (!event) serviceError('Event not found', 404)

  const admin = createSupabaseServerAdminClient()
  const { data: blocks, error: blocksError } = await admin
    .from('event_room_blocks')
    .select('id, event_id, room_id, date, start_time, end_time, all_day')
    .eq('event_id', id)

  if (blocksError) serviceError('Internal server error', 500)

  return toAdminEvent(event as EventRow, (blocks ?? []) as EventRoomBlockRow[])
}

export async function createEvent(body: {
  title?: unknown
  description?: unknown
  schedules?: unknown
  // Legacy single-block fields (kept for backward compat / existing tests)
  date?: unknown
  startTime?: unknown
  endTime?: unknown
  roomId?: unknown
  createdBy?: unknown
  allDay?: unknown
}): Promise<AdminEvent> {
  const title = String(body.title ?? '').trim()
  if (!title) serviceError('Title is required', 400)

  const description = body.description ? String(body.description).trim() : null

  // --- Multi-block path (new) ---
  if (Array.isArray(body.schedules)) {
    if (body.schedules.length === 0) serviceError('At least one schedule is required', 400)
    if (body.schedules.length > 366) serviceError('Too many schedule blocks', 400)

    const normBlocks = body.schedules.map((s, i) => validateAndNormaliseSchedule(s, i))

    const blocksPayload = normBlocks.map((b) => ({
      room_id: b.room_id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      all_day: b.all_day,
    }))

    const admin = createSupabaseServerAdminClient()
    const { data: result, error: rpcError } = await admin.rpc('create_event_with_blocks', {
      p_title: title,
      p_description: description,
      p_blocks: blocksPayload,
      p_created_by: body.createdBy ? String(body.createdBy) : null,
    })

    if (rpcError) {
      const pgCode = (rpcError as { code?: string }).code
      if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
        serviceError('Invalid event data', 400)
      }
      serviceError('Internal server error', 500)
    }
    return jsonToAdminEvent(result as Record<string, unknown>)
  }

  // --- Legacy single-block path (preserved for existing callers / tests) ---
  const date = String(body.date ?? '').trim()
  const allDay = parseAllDay(body.allDay)
  const resolvedTimes = resolveBlockTimes(date, String(body.startTime ?? '').trim(), String(body.endTime ?? '').trim(), allDay)
  const roomId = body.roomId ? String(body.roomId).trim() : null

  const admin = createSupabaseServerAdminClient()

  const { data: result, error: rpcError } = await admin.rpc('create_event_atomic', {
    p_title: title,
    p_description: description,
    p_date: date,
    p_start_time: resolvedTimes.startTime,
    p_end_time: resolvedTimes.endTime,
    p_room_id: roomId,
    p_all_day: allDay,
  })

  if (rpcError) serviceError('Internal server error', 500)

  return jsonToAdminEvent(result as Record<string, unknown>)
}

export async function updateEvent(
  id: string,
  body: {
    title?: unknown
    description?: unknown
    schedules?: unknown
    // Legacy single-block fields
    date?: unknown
    startTime?: unknown
    endTime?: unknown
    roomId?: unknown
    allDay?: unknown
  },
): Promise<AdminEvent> {
  const admin = createSupabaseServerAdminClient()

  // Load current event to fill in any fields not provided in the body
  const { data: current, error: fetchError } = await admin
    .from('events')
    .select('title, description, date, start_time, end_time, title_es, title_en')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) serviceError('Internal server error', 500)
  if (!current) serviceError('Event not found', 404)

  const currentRow = current as Pick<
    EventRow,
    'title' | 'description' | 'date' | 'start_time' | 'end_time' | 'title_es' | 'title_en'
  >

  // Finding 3: a club-event (landing) row is out of scope for this legacy
  // internal surface — treat it as not found, same as listEvents' filter.
  if (isClubEventRow(currentRow)) serviceError('Event not found', 404)

  const title = body.title !== undefined ? String(body.title).trim() || currentRow.title : currentRow.title
  const description =
    body.description !== undefined
      ? body.description === null
        ? null
        : String(body.description).trim() || null
      : currentRow.description

  // --- Multi-block path (new) ---
  if (Array.isArray(body.schedules)) {
    if (body.schedules.length === 0) serviceError('At least one schedule is required', 400)
    if (body.schedules.length > 366) serviceError('Too many schedule blocks', 400)

    const normBlocks = body.schedules.map((s, i) => validateAndNormaliseSchedule(s, i))

    const blocksPayload = normBlocks.map((b) => ({
      room_id: b.room_id,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      all_day: b.all_day,
    }))

    const { data: result, error: rpcError } = await admin.rpc('update_event_with_blocks', {
      p_id: id,
      p_title: title,
      p_description: description,
      p_blocks: blocksPayload,
    })

    if (rpcError) {
      const pgCode = (rpcError as { code?: string }).code
      if (pgCode === 'P0001') {
        serviceError('Event not found', 404)
      }
      if (pgCode === '23514' || pgCode === '22P02' || pgCode === '23502') {
        serviceError('Invalid event data', 400)
      }
      serviceError('Internal server error', 500)
    }
    return jsonToAdminEvent(result as Record<string, unknown>)
  }

  // --- Legacy single-block path ---
  const date = body.date !== undefined ? String(body.date).trim() || currentRow.date : currentRow.date
  const inputStartTime =
    body.startTime !== undefined ? String(body.startTime).trim() || currentRow.start_time : currentRow.start_time
  const inputEndTime =
    body.endTime !== undefined ? String(body.endTime).trim() || currentRow.end_time : currentRow.end_time

  let roomId: string | null
  let currentAllDay = false
  if (body.roomId === undefined || body.allDay === undefined) {
    const { data: existingBlocks } = await admin
      .from('event_room_blocks')
      .select('room_id, all_day')
      .eq('event_id', id)
      .limit(1)
    const firstBlock = (existingBlocks ?? [])[0] as { room_id: string; all_day: boolean } | undefined
    currentAllDay = firstBlock?.all_day ?? false
    roomId = body.roomId !== undefined
      ? (body.roomId ? String(body.roomId).trim() : null)
      : (firstBlock ? firstBlock.room_id : null)
  } else {
    roomId = body.roomId ? String(body.roomId).trim() : null
  }
  const allDay = body.allDay !== undefined ? parseAllDay(body.allDay) : currentAllDay
  const resolvedTimes = resolveBlockTimes(date, inputStartTime, inputEndTime, allDay)

  const { data: result, error: rpcError } = await admin.rpc('update_event_atomic', {
    p_id: id,
    p_title: title,
    p_description: description,
    p_date: date,
    p_start_time: resolvedTimes.startTime,
    p_end_time: resolvedTimes.endTime,
    p_room_id: roomId,
    p_all_day: allDay,
  })

  if (rpcError) serviceError('Internal server error', 500)

  return jsonToAdminEvent(result as Record<string, unknown>)
}

export async function deleteEvent(id: string): Promise<void> {
  const admin = createSupabaseServerAdminClient()

  const { data: eventData } = await admin
    .from('events')
    .select('id, title_es, title_en')
    .eq('id', id)
    .maybeSingle()

  if (!eventData) serviceError('Event not found', 404)

  // Finding 3: a club-event (landing) row is out of scope for this legacy
  // internal surface — treat it as not found, same as listEvents' filter.
  if (isClubEventRow(eventData as Pick<EventRow, 'id' | 'title_es' | 'title_en'>)) {
    serviceError('Event not found', 404)
  }

  await deleteEventCascade(admin, id)
}

/**
 * Cancel overlapping reservations for every room block attached to `id`,
 * then delete the event row (blocks cascade via FK). Shared by `deleteEvent`
 * (legacy internal surface, guarded above) and
 * `lib/server/club-events-service.ts`'s `deleteClubEvent` (which performs its
 * own club-event-row validation — the inverse of the guard above — before
 * calling this directly, so it must NOT go through the `isClubEventRow`
 * check in `deleteEvent`).
 */
export async function deleteEventCascade(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  id: string,
): Promise<void> {
  const { data: blocks } = await admin
    .from('event_room_blocks')
    .select('room_id, date, start_time, end_time')
    .eq('event_id', id)

  // Collect distinct room_ids and pre-fetch their table ids into a Map to avoid N+1 round trips
  const distinctRoomIds = [...new Set(
    ((blocks ?? []) as (EventRoomBlockRow & { date: string; start_time: string; end_time: string })[])
      .map((b) => b.room_id)
      .filter(Boolean),
  )]

  const roomTableMap = new Map<string, string[]>()
  if (distinctRoomIds.length > 0) {
    const { data: tables } = await admin
      .from('tables')
      .select('id, room_id')
      .in('room_id', distinctRoomIds)

    for (const t of (tables ?? []) as { id: string; room_id: string }[]) {
      const list = roomTableMap.get(t.room_id) ?? []
      list.push(t.id)
      roomTableMap.set(t.room_id, list)
    }
  }

  // Cancel overlapping reservations for every block (multi-day aware)
  for (const block of (blocks ?? []) as (EventRoomBlockRow & { date: string; start_time: string; end_time: string })[]) {
    const tableIds = roomTableMap.get(block.room_id) ?? []

    if (tableIds.length > 0) {
      const { error: cancelError } = await admin
        .from('reservations')
        .update({ status: 'cancelled' })
        .in('table_id', tableIds)
        .eq('date', block.date)
        .lt('start_time', block.end_time)
        .gt('end_time', block.start_time)
        .in('status', ['active', 'pending'])

      if (cancelError) serviceError('Internal server error', 500)
    }
  }

  const { error } = await admin.from('events').delete().eq('id', id)
  if (error) serviceError('Internal server error', 500)
}

export interface EventConflictBlock {
  date: string
  roomId: string
  count: number
}

export interface EventConflictPreview {
  total: number
  blocks: EventConflictBlock[]
}

export async function previewEventConflicts(body: {
  schedules?: unknown
}): Promise<EventConflictPreview> {
  if (!Array.isArray(body.schedules) || body.schedules.length === 0) {
    return { total: 0, blocks: [] }
  }
  if (body.schedules.length > 366) serviceError('Too many schedule blocks', 400)

  // Reuse the same validation path as createEvent/updateEvent
  const normBlocks = body.schedules.map((s, i) => validateAndNormaliseSchedule(s, i))

  // Only blocks with a non-null room_id can have reservations to cancel
  const roomedBlocks = normBlocks.filter((b): b is typeof b & { room_id: string } => b.room_id !== null)

  if (roomedBlocks.length === 0) {
    return { total: 0, blocks: [] }
  }

  const admin = createSupabaseServerAdminClient()

  // Pre-fetch table ids for all distinct rooms in one round-trip (avoids N+1)
  const distinctRoomIds = [...new Set(roomedBlocks.map((b) => b.room_id))]

  const { data: tables, error: tablesError } = await admin
    .from('tables')
    .select('id, room_id')
    .in('room_id', distinctRoomIds)

  if (tablesError) serviceError('Internal server error', 500)

  const roomTableMap = new Map<string, string[]>()
  for (const t of (tables ?? []) as { id: string; room_id: string }[]) {
    const list = roomTableMap.get(t.room_id) ?? []
    list.push(t.id)
    roomTableMap.set(t.room_id, list)
  }

  const resultBlocks: EventConflictBlock[] = []
  let total = 0

  for (const block of roomedBlocks) {
    const tableIds = roomTableMap.get(block.room_id) ?? []

    if (tableIds.length === 0) {
      resultBlocks.push({ date: block.date, roomId: block.room_id, count: 0 })
      continue
    }

    const { count, error: countError } = await admin
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .in('table_id', tableIds)
      .eq('date', block.date)
      .lt('start_time', block.end_time)
      .gt('end_time', block.start_time)
      .in('status', ['active', 'pending'])

    if (countError) serviceError('Internal server error', 500)

    const blockCount = count ?? 0
    total += blockCount
    resultBlocks.push({ date: block.date, roomId: block.room_id, count: blockCount })
  }

  return { total, blocks: resultBlocks }
}

export async function listEventsBlockingRoom(
  roomId: string,
  date: string,
  start: string,
  end: string,
): Promise<AdminEvent[]> {
  const admin = createSupabaseServerAdminClient()

  const { data: blocks, error } = await admin
    .from('event_room_blocks')
    .select('event_id')
    .eq('room_id', roomId)
    .eq('date', date)
    .lt('start_time', end)
    .gt('end_time', start)

  if (error) serviceError('Internal server error', 500)

  const eventIds = ((blocks ?? []) as { event_id: string }[]).map((b) => b.event_id)
  if (eventIds.length === 0) return []

  const { data: events, error: eventsError } = await admin
    .from('events')
    .select('id, title, description, date, start_time, end_time, created_by, created_at')
    .in('id', eventIds)

  if (eventsError) serviceError('Internal server error', 500)

  return ((events ?? []) as EventRow[]).map((row) => toAdminEvent(row, []))
}
