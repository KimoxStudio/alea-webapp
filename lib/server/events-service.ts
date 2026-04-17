import 'server-only'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'
import type { AdminEvent, AdminEventRoomBlock } from '@/lib/types'

export type { AdminEvent, AdminEventRoomBlock }

type EventRow = Tables<'events'>
type EventRoomBlockRow = Tables<'event_room_blocks'>

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

function resolveEventTimes(date: string, startTime: string, endTime: string, allDay: boolean) {
  if (!DATE_RE.test(date)) serviceError('date must be in YYYY-MM-DD format', 400)
  if (allDay) {
    return { startTime: '00:00', endTime: '23:59' }
  }

  validateDateTimeFields(date, startTime, endTime)
  return { startTime, endTime }
}

function toAdminEvent(row: EventRow, blocks: EventRoomBlockRow[]): AdminEvent {
  const inferredAllDay = row.start_time.slice(0, 5) === '00:00' && row.end_time.slice(0, 5) === '23:59'
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    createdBy: row.created_by,
    createdAt: row.created_at,
    roomBlocks: blocks.map((b) => ({
      id: b.id,
      roomId: b.room_id,
      date: b.date,
      startTime: b.start_time,
      endTime: b.end_time,
      allDay: b.all_day,
    })),
    allDay: blocks.some((b) => b.all_day) || inferredAllDay,
  }
}

function jsonToAdminEvent(obj: Record<string, unknown>): AdminEvent {
  const rawBlocks = Array.isArray(obj.room_blocks) ? obj.room_blocks : []
  const inferredAllDay = String(obj.start_time).slice(0, 5) === '00:00' && String(obj.end_time).slice(0, 5) === '23:59'
  return {
    id: String(obj.id),
    title: String(obj.title),
    description: obj.description != null ? String(obj.description) : null,
    date: String(obj.date),
    startTime: String(obj.start_time),
    endTime: String(obj.end_time),
    createdBy: obj.created_by != null ? String(obj.created_by) : null,
    createdAt: String(obj.created_at),
    roomBlocks: rawBlocks.map((b: unknown) => {
      const block = b as Record<string, unknown>
      return {
        id: String(block.id),
        roomId: String(block.room_id),
        date: String(block.date),
        startTime: String(block.start_time),
        endTime: String(block.end_time),
        allDay: Boolean(block.all_day),
      }
    }),
    allDay: rawBlocks.some((b: unknown) => Boolean((b as Record<string, unknown>).all_day)) || inferredAllDay,
  }
}

export async function listEvents(): Promise<AdminEvent[]> {
  const supabase = await createSupabaseServerClient()
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (eventsError) serviceError('Internal server error', 500)

  const rows = (events ?? []) as EventRow[]
  if (rows.length === 0) return []

  const admin = createSupabaseServerAdminClient()
  const { data: blocks, error: blocksError } = await admin
    .from('event_room_blocks')
    .select('*')
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
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (eventError) serviceError('Internal server error', 500)
  if (!event) serviceError('Event not found', 404)

  const admin = createSupabaseServerAdminClient()
  const { data: blocks, error: blocksError } = await admin
    .from('event_room_blocks')
    .select('*')
    .eq('event_id', id)

  if (blocksError) serviceError('Internal server error', 500)

  return toAdminEvent(event as EventRow, (blocks ?? []) as EventRoomBlockRow[])
}

export async function createEvent(body: {
  title?: unknown
  description?: unknown
  date?: unknown
  startTime?: unknown
  endTime?: unknown
  roomId?: unknown
  createdBy?: unknown
  allDay?: unknown
}): Promise<AdminEvent> {
  const title = String(body.title).trim()
  if (!title) serviceError('Title is required', 400)

  const date = String(body.date).trim()
  const allDay = parseAllDay(body.allDay)
  const resolvedTimes = resolveEventTimes(date, String(body.startTime ?? '').trim(), String(body.endTime ?? '').trim(), allDay)

  const description = body.description ? String(body.description).trim() : null
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
    .select('title, description, date, start_time, end_time')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) serviceError('Internal server error', 500)
  if (!current) serviceError('Event not found', 404)

  const currentRow = current as Pick<EventRow, 'title' | 'description' | 'date' | 'start_time' | 'end_time'>

  // Resolve final values (body takes precedence over current row)
  const title = body.title !== undefined ? String(body.title).trim() || currentRow.title : currentRow.title
  const description =
    body.description !== undefined
      ? body.description === null
        ? null
        : String(body.description).trim() || null
      : currentRow.description
  const date = body.date !== undefined ? String(body.date).trim() || currentRow.date : currentRow.date
  const inputStartTime =
    body.startTime !== undefined ? String(body.startTime).trim() || currentRow.start_time : currentRow.start_time
  const inputEndTime =
    body.endTime !== undefined ? String(body.endTime).trim() || currentRow.end_time : currentRow.end_time

  // Resolve room: if body.roomId is present use it (null means remove), otherwise load existing block
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
  const resolvedTimes = resolveEventTimes(date, inputStartTime, inputEndTime, allDay)

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
  // Check for active/pending reservations on rooms blocked by this event
  const admin = createSupabaseServerAdminClient()

  const { data: eventData } = await admin
    .from('events')
    .select('date, start_time, end_time')
    .eq('id', id)
    .maybeSingle()

  if (!eventData) serviceError('Event not found', 404)

  const event = eventData as Pick<EventRow, 'date' | 'start_time' | 'end_time'>

  const { data: blocks } = await admin
    .from('event_room_blocks')
    .select('room_id')
    .eq('event_id', id)

  const roomIds = ((blocks ?? []) as EventRoomBlockRow[]).map((b) => b.room_id)

  if (roomIds.length > 0) {
    // Find tables in those rooms
    const { data: tables } = await admin
      .from('tables')
      .select('id')
      .in('room_id', roomIds)

    const tableIds = ((tables ?? []) as { id: string }[]).map((t) => t.id)

    if (tableIds.length > 0) {
      const { error: cancelError } = await admin
        .from('reservations')
        .update({ status: 'cancelled' })
        .in('table_id', tableIds)
        .eq('date', event.date)
        .lt('start_time', event.end_time)
        .gt('end_time', event.start_time)
        .in('status', ['active', 'pending'])

      if (cancelError) serviceError('Internal server error', 500)
    }
  }

  const { error } = await admin.from('events').delete().eq('id', id)
  if (error) serviceError('Internal server error', 500)
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
    .select('*')
    .in('id', eventIds)

  if (eventsError) serviceError('Internal server error', 500)

  return ((events ?? []) as EventRow[]).map((row) => toAdminEvent(row, []))
}
