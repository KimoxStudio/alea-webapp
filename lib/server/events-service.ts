import 'server-only'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { TablesInsert, TablesUpdate, EventRow, EventRoomBlockRow } from '@/lib/supabase/types'
import type { AdminEvent, AdminEventRoomBlock } from '@/lib/types'

export type { AdminEvent, AdminEventRoomBlock }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function validateDateTimeFields(date: string, startTime: string, endTime: string): void {
  if (!DATE_RE.test(date)) serviceError('date must be in YYYY-MM-DD format', 400)
  if (!TIME_RE.test(startTime)) serviceError('startTime must be in HH:MM format', 400)
  if (!TIME_RE.test(endTime)) serviceError('endTime must be in HH:MM format', 400)
  if (endTime <= startTime) serviceError('endTime must be after startTime', 400)
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

  validateDateTimeFields(date, startTime, endTime)

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

  const newDate = body.date !== undefined ? String(body.date).trim() || undefined : undefined
  const newStartTime = body.startTime !== undefined ? String(body.startTime).trim() || undefined : undefined
  const newEndTime = body.endTime !== undefined ? String(body.endTime).trim() || undefined : undefined

  if (newDate !== undefined) updates.date = newDate
  if (newStartTime !== undefined) updates.start_time = newStartTime
  if (newEndTime !== undefined) updates.end_time = newEndTime

  // Validate date/time fields if any are being updated
  if (newDate !== undefined || newStartTime !== undefined || newEndTime !== undefined) {
    // We need all three to validate; load current values for fields not being changed
    const admin = createSupabaseServerAdminClient()
    const { data: current } = await admin
      .from('events')
      .select('date, start_time, end_time')
      .eq('id', id)
      .maybeSingle()

    if (!current) serviceError('Event not found', 404)
    const currentRow = current as Pick<EventRow, 'date' | 'start_time' | 'end_time'>
    const validatedDate = newDate ?? currentRow.date
    const validatedStart = newStartTime ?? currentRow.start_time
    const validatedEnd = newEndTime ?? currentRow.end_time
    validateDateTimeFields(validatedDate, validatedStart, validatedEnd)
  }

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

  // Update room blocks when roomId or date/time fields change
  const dateTimeChanged = newDate !== undefined || newStartTime !== undefined || newEndTime !== undefined
  if (body.roomId !== undefined || dateTimeChanged) {
    const roomId = body.roomId !== undefined
      ? (body.roomId ? String(body.roomId).trim() : null)
      : undefined  // undefined means "keep existing room, just update times"

    if (body.roomId !== undefined) {
      // roomId is explicitly being changed — delete all existing blocks and re-create if needed
      const { error: deleteError } = await admin
        .from('event_room_blocks')
        .delete()
        .eq('event_id', id)
      if (deleteError) serviceError('Internal server error', 500)

      if (roomId) {
        const { error: insertError } = await admin.from('event_room_blocks').insert({
          event_id: id,
          room_id: roomId,
          date: eventRow.date,
          start_time: eventRow.start_time,
          end_time: eventRow.end_time,
        })
        if (insertError) serviceError('Internal server error', 500)
      }
    } else if (dateTimeChanged) {
      // Only date/time changed — update existing blocks in place
      const { error: blockUpdateError } = await admin
        .from('event_room_blocks')
        .update({
          date: eventRow.date,
          start_time: eventRow.start_time,
          end_time: eventRow.end_time,
        })
        .eq('event_id', id)
      if (blockUpdateError) serviceError('Internal server error', 500)
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
