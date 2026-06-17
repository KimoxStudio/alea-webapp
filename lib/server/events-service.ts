import type { AdminEvent, CreateEventRequest } from '@/lib/types'
import { serviceError } from '@/lib/server/service-error'
import { createSupabaseServerAdminClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert } from '@/lib/supabase/types'

type EventRow = Tables<'events'>
type EventRoomRow = Tables<'event_rooms'>
type EventScheduleRow = Tables<'event_schedules'>
type EventBlock = { start: string; end: string }

const EVENT_COLUMNS = 'id, title, description, created_at, updated_at'
const EVENT_ROOM_COLUMNS = 'event_id, room_id'
const EVENT_SCHEDULE_COLUMNS = 'id, event_id, date, start_time, end_time'

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
    serviceError('Time must be in HH:MM format (00:00-23:59)', 400)
  }
  return value
}

function normalizeTime(value: string) {
  return value.slice(0, 5)
}

function uniqueStrings(values: unknown[]): string[] {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
}

function parseEventBody(body: Partial<CreateEventRequest>) {
  const title = String(body.title ?? '').trim()
  if (!title) {
    serviceError('Event title is required', 400)
  }

  const roomIds = uniqueStrings(Array.isArray(body.roomIds) ? body.roomIds : [])
  if (roomIds.length === 0) {
    serviceError('At least one room is required', 400)
  }

  const rawSchedules = Array.isArray(body.schedules) ? body.schedules : []
  if (rawSchedules.length === 0) {
    serviceError('At least one schedule is required', 400)
  }

  const schedules = rawSchedules.map((schedule) => {
    const date = parseDate(String(schedule.date ?? ''))
    const startTime = parseHHMM(String(schedule.startTime ?? ''))
    const endTime = parseHHMM(String(schedule.endTime ?? ''))
    if (startTime >= endTime) {
      serviceError('Invalid event time range', 400)
    }
    return { date, startTime, endTime }
  })

  return {
    title,
    description: body.description ? String(body.description).trim() : null,
    roomIds,
    schedules,
  }
}

function mapEvent(
  event: EventRow,
  rooms: EventRoomRow[],
  schedules: EventScheduleRow[],
): AdminEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    roomIds: rooms.filter((room) => room.event_id === event.id).map((room) => room.room_id),
    schedules: schedules
      .filter((schedule) => schedule.event_id === event.id)
      .map((schedule) => ({
        id: schedule.id,
        eventId: schedule.event_id,
        date: schedule.date,
        startTime: normalizeTime(schedule.start_time),
        endTime: normalizeTime(schedule.end_time),
      })),
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  }
}

async function fetchEventParts(eventIds: string[]) {
  const admin = createSupabaseServerAdminClient()
  if (eventIds.length === 0) {
    return { rooms: [] as EventRoomRow[], schedules: [] as EventScheduleRow[] }
  }

  const [roomsResult, schedulesResult] = await Promise.all([
    admin.from('event_rooms').select(EVENT_ROOM_COLUMNS).in('event_id', eventIds),
    admin.from('event_schedules').select(EVENT_SCHEDULE_COLUMNS).in('event_id', eventIds),
  ])

  if (roomsResult.error || schedulesResult.error) {
    serviceError('Internal server error', 500)
  }

  return {
    rooms: (roomsResult.data ?? []) as EventRoomRow[],
    schedules: (schedulesResult.data ?? []) as EventScheduleRow[],
  }
}

export async function listEvents() {
  const admin = createSupabaseServerAdminClient()
  const { data, error } = await admin
    .from('events')
    .select(EVENT_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) {
    serviceError('Internal server error', 500)
  }

  const events = (data ?? []) as EventRow[]
  const parts = await fetchEventParts(events.map((event) => event.id))
  return events.map((event) => mapEvent(event, parts.rooms, parts.schedules))
}

export async function createEvent(body: Partial<CreateEventRequest>) {
  const input = parseEventBody(body)
  const admin = createSupabaseServerAdminClient()

  const { data, error } = await admin
    .from('events')
    .insert({ title: input.title, description: input.description } satisfies TablesInsert<'events'>)
    .select(EVENT_COLUMNS)
    .maybeSingle()

  if (error || !data) {
    serviceError('Internal server error', 500)
  }

  await replaceEventChildren(data.id, input.roomIds, input.schedules)
  const parts = await fetchEventParts([data.id])
  return mapEvent(data as EventRow, parts.rooms, parts.schedules)
}

export async function updateEvent(eventId: string, body: Partial<CreateEventRequest>) {
  const input = parseEventBody(body)
  const admin = createSupabaseServerAdminClient()

  const { data, error } = await admin
    .from('events')
    .update({ title: input.title, description: input.description, updated_at: new Date().toISOString() })
    .eq('id', eventId)
    .select(EVENT_COLUMNS)
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('Event not found', 404)
  }

  await replaceEventChildren(eventId, input.roomIds, input.schedules)
  const parts = await fetchEventParts([eventId])
  return mapEvent(data as EventRow, parts.rooms, parts.schedules)
}

export async function deleteEvent(eventId: string) {
  const admin = createSupabaseServerAdminClient()
  const { error } = await admin.from('events').delete().eq('id', eventId)

  if (error) {
    serviceError('Internal server error', 500)
  }
}

async function replaceEventChildren(
  eventId: string,
  roomIds: string[],
  schedules: Array<{ date: string; startTime: string; endTime: string }>,
) {
  const admin = createSupabaseServerAdminClient()
  const [roomsDelete, schedulesDelete] = await Promise.all([
    admin.from('event_rooms').delete().eq('event_id', eventId),
    admin.from('event_schedules').delete().eq('event_id', eventId),
  ])

  if (roomsDelete.error || schedulesDelete.error) {
    serviceError('Internal server error', 500)
  }

  const [roomsInsert, schedulesInsert] = await Promise.all([
    admin.from('event_rooms').insert(roomIds.map((roomId) => ({ event_id: eventId, room_id: roomId }))),
    admin.from('event_schedules').insert(schedules.map((schedule) => ({
      event_id: eventId,
      date: schedule.date,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
    }))),
  ])

  if (roomsInsert.error || schedulesInsert.error) {
    serviceError('Internal server error', 500)
  }
}

export function hasEventConflict(
  blocks: EventBlock[],
  input: { startTime: string; endTime: string },
) {
  return blocks.some((block) => block.start < input.endTime && input.startTime < block.end)
}

export async function listEventBlocksForRoom(input: {
  roomId: string
  date: string
}): Promise<EventBlock[]> {
  const admin = createSupabaseServerAdminClient()
  const roomsResult = await admin
    .from('event_rooms')
    .select(EVENT_ROOM_COLUMNS)
    .eq('room_id', input.roomId)

  if (roomsResult.error) {
    serviceError('Internal server error', 500)
  }

  const eventIds = ((roomsResult.data ?? []) as EventRoomRow[]).map((row) => row.event_id)
  if (eventIds.length === 0) {
    return []
  }

  const schedulesResult = await admin
    .from('event_schedules')
    .select(EVENT_SCHEDULE_COLUMNS)
    .eq('date', input.date)
    .in('event_id', eventIds)

  if (schedulesResult.error) {
    serviceError('Internal server error', 500)
  }

  return ((schedulesResult.data ?? []) as EventScheduleRow[]).map((schedule) => ({
    start: normalizeTime(schedule.start_time),
    end: normalizeTime(schedule.end_time),
  }))
}

export async function listEventBlocksForRooms(input: {
  roomIds: string[]
  date: string
}): Promise<Map<string, EventBlock[]>> {
  const admin = createSupabaseServerAdminClient()
  const blocksByRoom = new Map<string, EventBlock[]>()
  if (input.roomIds.length === 0) {
    return blocksByRoom
  }

  const roomsResult = await admin
    .from('event_rooms')
    .select(EVENT_ROOM_COLUMNS)
    .in('room_id', input.roomIds)

  if (roomsResult.error) {
    serviceError('Internal server error', 500)
  }

  const eventRooms = (roomsResult.data ?? []) as EventRoomRow[]
  const eventIds = uniqueStrings(eventRooms.map((row) => row.event_id))
  if (eventIds.length === 0) {
    return blocksByRoom
  }

  const schedulesResult = await admin
    .from('event_schedules')
    .select(EVENT_SCHEDULE_COLUMNS)
    .eq('date', input.date)
    .in('event_id', eventIds)

  if (schedulesResult.error) {
    serviceError('Internal server error', 500)
  }

  const schedulesByEvent = new Map<string, EventBlock[]>()
  for (const schedule of (schedulesResult.data ?? []) as EventScheduleRow[]) {
    const items = schedulesByEvent.get(schedule.event_id) ?? []
    items.push({ start: normalizeTime(schedule.start_time), end: normalizeTime(schedule.end_time) })
    schedulesByEvent.set(schedule.event_id, items)
  }

  for (const eventRoom of eventRooms) {
    const items = blocksByRoom.get(eventRoom.room_id) ?? []
    items.push(...(schedulesByEvent.get(eventRoom.event_id) ?? []))
    blocksByRoom.set(eventRoom.room_id, items)
  }

  return blocksByRoom
}
