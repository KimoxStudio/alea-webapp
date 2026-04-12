import 'server-only'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables, TablesInsert, TablesUpdate, EventRow, EventRoomBlockRow } from '@/lib/supabase/types'

type ReservationRow = Tables<'reservations'>

export interface AdminEvent {
  id: string
  title: string
  description: string | null
  date: string
  startTime: string
  endTime: string
  createdBy: string | null
  createdAt: string
  roomBlocks: AdminEventRoomBlock[]
}

export interface AdminEventRoomBlock {
  id: string
  roomId: string
  date: string
  startTime: string
  endTime: string
}

function toAdminEvent(row: EventRow, blocks: EventRoomBlockRow[]): AdminEvent {
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
    })),
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
}): Promise<AdminEvent> {
  const title = String(body.title ?? '').trim()
  if (!title) serviceError('Event title is required', 400)

  const date = String(body.date ?? '').trim()
  if (!date) serviceError('Event date is required', 400)

  const startTime = String(body.startTime ?? '').trim()
  if (!startTime) serviceError('Event start time is required', 400)

  const endTime = String(body.endTime ?? '').trim()
  if (!endTime) serviceError('Event end time is required', 400)

  const roomId = body.roomId ? String(body.roomId).trim() : undefined

  const admin = createSupabaseServerAdminClient()

  const insert: TablesInsert<'events'> = {
    title,
    description: body.description ? String(body.description).trim() : null,
    date,
    start_time: startTime,
    end_time: endTime,
    created_by: body.createdBy ? String(body.createdBy) : null,
  }

  const { data: createdEvent, error: insertError } = await admin
    .from('events')
    .insert(insert)
    .select('*')
    .maybeSingle()

  if (insertError) serviceError('Internal server error', 500)
  if (!createdEvent) serviceError('Internal server error', 500)

  const eventRow = createdEvent as EventRow
  let blocks: EventRoomBlockRow[] = []

  if (roomId) {
    const blockInsert: TablesInsert<'event_room_blocks'> = {
      event_id: eventRow.id,
      room_id: roomId,
      date,
      start_time: startTime,
      end_time: endTime,
    }
    const { data: blockData, error: blockError } = await admin
      .from('event_room_blocks')
      .insert(blockInsert)
      .select('*')

    if (blockError) serviceError('Internal server error', 500)
    blocks = (blockData ?? []) as EventRoomBlockRow[]
  }

  return toAdminEvent(eventRow, blocks)
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
  },
): Promise<AdminEvent> {
  const updates: TablesUpdate<'events'> = {}
  if (body.title !== undefined) updates.title = String(body.title).trim() || undefined
  if (body.description !== undefined) {
    updates.description = body.description === null ? null : String(body.description).trim() || null
  }
  if (body.date !== undefined) updates.date = String(body.date).trim() || undefined
  if (body.startTime !== undefined) updates.start_time = String(body.startTime).trim() || undefined
  if (body.endTime !== undefined) updates.end_time = String(body.endTime).trim() || undefined

  const admin = createSupabaseServerAdminClient()

  const { data: updatedEvent, error: updateError } = await admin
    .from('events')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (updateError) serviceError('Internal server error', 500)
  if (!updatedEvent) serviceError('Event not found', 404)

  const eventRow = updatedEvent as EventRow

  // Update room block if roomId provided
  if (body.roomId !== undefined) {
    const roomId = body.roomId ? String(body.roomId).trim() : null
    // Delete existing blocks
    await admin.from('event_room_blocks').delete().eq('event_id', id)

    if (roomId) {
      await admin.from('event_room_blocks').insert({
        event_id: id,
        room_id: roomId,
        date: eventRow.date,
        start_time: eventRow.start_time,
        end_time: eventRow.end_time,
      })
    }
  }

  const { data: blocks } = await admin
    .from('event_room_blocks')
    .select('*')
    .eq('event_id', id)

  return toAdminEvent(eventRow, (blocks ?? []) as EventRoomBlockRow[])
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
      const { data: conflicting } = await admin
        .from('reservations')
        .select('id')
        .in('table_id', tableIds)
        .eq('date', event.date)
        .in('status', ['active', 'pending'])
        .limit(1)

      if (conflicting && (conflicting as ReservationRow[]).length > 0) {
        serviceError('Cannot delete event: active or pending reservations exist for this room during the event time', 409)
      }
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
