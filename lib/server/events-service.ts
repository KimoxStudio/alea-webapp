import 'server-only'
import { sql } from '@/lib/db/client'
import { NeonDbError } from '@neondatabase/serverless'
import { serviceError } from '@/lib/server/service-error'
import type { Tables } from '@/lib/supabase/types'

/**
 * Shared Neon-backed helpers reused by `lib/server/club-events-service.ts`
 * (the "Eventos" unified admin flow, the only live consumer of events/
 * event_room_blocks writes).
 *
 * This file used to also host a legacy internal "events" admin surface
 * (`listEvents`/`getEvent`/`createEvent`/`updateEvent`/`deleteEvent`/
 * `previewEventConflicts`/`listEventsBlockingRoom`) behind `app/api/events/*`.
 * That surface had zero UI consumers — `use-admin.ts`'s event hooks were dead
 * code — and was removed in #353. `deleteEventCascade` below is the one piece
 * of write logic that survived the removal (it is still the live cascade
 * behind `club-events-service.ts`'s `deleteClubEvent`); it did NOT scope
 * reservation cancellation to a single table even when a block's `table_id`
 * was set, unlike `club-events-service.ts`'s
 * `applyClubEventBlocksAndMaterials`, and was fixed to match in the same
 * #353 round. What remains here are the pieces `club-events-service.ts`
 * still imports: `isClubEventRow`, `validateAndNormaliseSchedule` (schedule
 * validation shared by the club-events "blocks rooms" sub-flow),
 * `mapEventWriteError` (events/event_room_blocks/event_equipment write error
 * mapping), `deleteEventCascade` (cancels overlapping reservations then
 * deletes an event, cascading its blocks), and `restoreCancelledReservations`
 * (best-effort compensating rollback for cancelled reservations).
 *
 * These are raw-SQL Neon helpers using the tagged-template `sql` export from
 * `lib/db/client.ts`, matching the established style from
 * `equipment-service.ts`, `rooms-service.ts`/`tables-service.ts` and
 * `database-time.ts`. Neon's HTTP driver's `sql.transaction()` only batches
 * queries that are fully built up-front (no branching on a prior query's
 * runtime result), so multi-step writes here use sequential non-transactional
 * statements with compensating rollback on failure, matching
 * `reservations-service.ts`'s established precedent.
 */

type EventRow = Tables<'events'>

// ---------------------------------------------------------------------------
// Shared "is this a club-event (landing) row?" predicate (OIR-203 code
// review, Finding 3). A row becomes public landing content once BOTH
// title_es and title_en are populated (see lib/server/club-events-service.ts,
// which owns all reads/writes of such rows).
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

// ---------------------------------------------------------------------------
// Validate a raw schedule payload element and return normalised block
//
// Exported so lib/server/club-events-service.ts (OIR-203) can reuse the same
// validation for the public club-event "blocks rooms" sub-flow instead of
// duplicating date/time parsing rules.
// ---------------------------------------------------------------------------
export interface NormalisedEventSchedule {
  room_id: string | null
  /** Null blocks the whole room; a table id scopes the block to that single table (OIR-208). */
  table_id: string | null
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
  // OIR-208: a schedule row may optionally scope its block to a single table
  // of the room (empty/"Sala entera" = whole room, unchanged behavior).
  // Ignored when no room is attached — a table without a room makes no sense.
  const tableId = roomId && s.tableId ? String(s.tableId).trim() || null : null

  return {
    room_id: roomId,
    table_id: tableId,
    date,
    start_time: resolved.startTime,
    end_time: resolved.endTime,
    all_day: allDay,
  }
}

/** Maps a NeonDbError from an events/event_room_blocks write to the same 400/500
 *  split the old create_event_with_blocks/update_event_with_blocks RPC error handling used.
 *  Exported (#304 code-review, medium effort) — `club-events-service.ts`'s
 *  `applyClubEventBlocksAndMaterials` writes to the same events/
 *  event_room_blocks/event_equipment tables and hit the exact same 5 Postgres
 *  error codes, so it reuses this instead of keeping a verbatim duplicate. */
export function mapEventWriteError(error: unknown): never {
  if (
    error instanceof NeonDbError &&
    (error.code === '23514' || error.code === '22P02' || error.code === '23502' ||
      error.code === '23503' || error.code === '23505')
  ) {
    // 23503 = foreign_key_violation — e.g. an invalid roomId on a block
    // insert (event_room_blocks_room_id_fkey). 23505 = unique_violation —
    // e.g. a duplicate schedule block hitting event_room_blocks' unique
    // index on (event_id, room_id, date, start_time, end_time) (see
    // lib/db/schema/009_event_room_blocks.sql). Same 400 treatment as the
    // other input-shape errors above (#303 code-review, high-effort round),
    // matching equipment-service.ts's convention of mapping 23505 to 400.
    serviceError('Invalid event data', 400)
  }
  serviceError('Internal server error', 500)
}

/** A reservation cancelled during event/reservation-overlap cancellation, with
 *  the status it had before cancellation — needed to restore it exactly on
 *  rollback rather than assuming 'active'. */
export interface CancelledReservation {
  id: string
  status: string
}

/**
 * Best-effort compensation used by `deleteEventCascade`: restores reservations
 * that this call cancelled back to their captured pre-cancellation status
 * (`'active'` or `'pending'`) rather than assuming `'active'`. Errors here are
 * logged and swallowed, matching the compensating-rollback pattern used
 * throughout this file.
 *
 * Exported (#304 code-review, medium effort) — `club-events-service.ts`'s
 * `rollbackClubEventBlocksWrite` needs the identical status-aware restore for
 * its own `cancelledReservations` and previously reimplemented it verbatim.
 */
export async function restoreCancelledReservations(cancelled: CancelledReservation[]): Promise<void> {
  if (cancelled.length === 0) return
  try {
    const pendingIds = cancelled.filter((r) => r.status === 'pending').map((r) => r.id)
    const activeIds = cancelled.filter((r) => r.status !== 'pending').map((r) => r.id)
    if (activeIds.length > 0) {
      await sql`
        UPDATE reservations
        SET status = 'active'
        WHERE id = ANY(${activeIds}) AND status = 'cancelled'
      `
    }
    if (pendingIds.length > 0) {
      await sql`
        UPDATE reservations
        SET status = 'pending'
        WHERE id = ANY(${pendingIds}) AND status = 'cancelled'
      `
    }
  } catch (rollbackError) {
    console.error('events-service: compensating reservation restore failed (non-fatal):', rollbackError)
  }
}

/**
 * Resolves which table ids a room block's reservation-cancellation should
 * target: just the block's own table when the block is scoped to one,
 * otherwise every table in the block's room (`roomTableMap` is a pre-fetched
 * room id → table ids lookup, built once per call site to avoid N+1 queries).
 *
 * Shared by `deleteEventCascade` below and `club-events-service.ts`'s
 * `applyClubEventBlocksAndMaterials` — both independently wrote this exact
 * branch (#353 code-review, high effort), which is how the room-wide-only
 * cancellation bug fixed in `deleteEventCascade` below slipped in: the same
 * logic had already been written correctly once, in the other file, but
 * nothing shared it.
 */
export function resolveBlockCancellationTableIds(
  blockTableId: string | null,
  roomId: string,
  roomTableMap: Map<string, string[]>,
): string[] {
  return blockTableId ? [blockTableId] : (roomTableMap.get(roomId) ?? [])
}

/**
 * Cancel overlapping reservations for every room block attached to `id`,
 * then delete the event row (blocks cascade via FK). Used by
 * `lib/server/club-events-service.ts`'s `deleteClubEvent`, which performs its
 * own club-event-row validation before calling this directly.
 *
 * Table-level scoping (OIR-208, #353 fix): a block with a `table_id` only
 * cancels reservations for that single table; a null `table_id` cancels
 * reservations across every table of the room — mirrors
 * `club-events-service.ts`'s `applyClubEventBlocksAndMaterials`. Previously
 * this always cancelled across the room's full table list regardless of
 * `table_id`, wrongly cancelling reservations on other tables in the same
 * room when deleting a club event whose block was scoped to one table.
 *
 * Final-delete-ordering (#304 fix): reservations cancelled by this call are
 * captured (id + pre-cancellation status, via `UPDATE ... FROM` `RETURNING`)
 * and reverted if a later cancellation in the loop or the final
 * `DELETE FROM events` fails — previously a failed final delete left those
 * cancellations un-reverted, the same bug class fixed elsewhere in #303's
 * rollback work.
 */
export async function deleteEventCascade(id: string): Promise<void> {
  let blocks: Array<{ room_id: string; table_id: string | null; date: string; start_time: string; end_time: string }>
  try {
    blocks = await sql`
      SELECT room_id, table_id, date::text AS date, start_time, end_time
      FROM event_room_blocks
      WHERE event_id = ${id}
    ` as Array<{ room_id: string; table_id: string | null; date: string; start_time: string; end_time: string }>
  } catch {
    serviceError('Internal server error', 500)
  }

  // Collect distinct room_ids and pre-fetch their table ids into a Map to avoid N+1 round trips
  const distinctRoomIds = [...new Set(blocks.map((b) => b.room_id).filter(Boolean))]

  const roomTableMap = new Map<string, string[]>()
  if (distinctRoomIds.length > 0) {
    let tables: Array<{ id: string; room_id: string }>
    try {
      tables = await sql`
        SELECT id, room_id FROM tables WHERE room_id = ANY(${distinctRoomIds})
      ` as Array<{ id: string; room_id: string }>
    } catch {
      serviceError('Internal server error', 500)
    }

    for (const t of tables) {
      const list = roomTableMap.get(t.room_id) ?? []
      list.push(t.id)
      roomTableMap.set(t.room_id, list)
    }
  }

  // Cancel overlapping reservations for every block (multi-day aware),
  // capturing each cancelled reservation's id AND pre-cancellation status
  // (via an `UPDATE ... FROM` `RETURNING`) so they can be restored if a
  // later cancellation or the final DELETE FROM events below fails
  // (#304 fix).
  const cancelledReservations: CancelledReservation[] = []
  for (const block of blocks) {
    // Table-level scoping (OIR-208, #353 fix): a block with a table_id only
    // cancels reservations for that single table; a null table_id cancels
    // reservations across every table of the room — mirrors
    // `club-events-service.ts`'s `applyClubEventBlocksAndMaterials`, which
    // already did this correctly. Previously this always used the room's
    // full table list regardless of `table_id`, wrongly cancelling
    // reservations on other tables in the same room when a club event's
    // block was scoped to one specific table.
    const tableIds = resolveBlockCancellationTableIds(block.table_id, block.room_id, roomTableMap)

    if (tableIds.length > 0) {
      let cancelledRows: CancelledReservation[]
      try {
        cancelledRows = await sql`
          UPDATE reservations
          SET status = 'cancelled'
          FROM (
            SELECT id, status FROM reservations
            WHERE table_id = ANY(${tableIds})
              AND date = ${block.date}
              AND start_time < ${block.end_time}
              AND end_time > ${block.start_time}
              AND status IN ('active', 'pending')
          ) AS prior
          WHERE reservations.id = prior.id
          RETURNING reservations.id, prior.status
        ` as CancelledReservation[]
      } catch {
        // Revert any cancellations this call already made before the one
        // that just failed — same compensating shape as the final-DELETE
        // failure branch below.
        await restoreCancelledReservations(cancelledReservations)
        serviceError('Internal server error', 500)
      }
      cancelledReservations.push(...cancelledRows)
    }
  }

  try {
    await sql`DELETE FROM events WHERE id = ${id}`
  } catch {
    // #304 fix: the final DELETE is the last statement in this cascade — if
    // it fails, the reservation cancellations performed above must not be
    // left in place (they were only ever valid alongside the event's
    // removal).
    await restoreCancelledReservations(cancelledReservations)
    serviceError('Internal server error', 500)
  }
}
