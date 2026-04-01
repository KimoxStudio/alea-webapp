import type { Reservation, TableSurface } from '@alea/types'
import type { SessionUser } from '@/lib/server/auth'
import { createReservation, findReservationById, getTableById, hasReservationConflict, listReservations, updateReservationById } from '@/lib/server/mock-db'
import { serviceError } from '@/lib/server/service-error'

function parseSurface(value: unknown): TableSurface | undefined {
  return value === 'top' || value === 'bottom' ? value : undefined
}

function requireString(value: unknown): string {
  return String(value ?? '')
}

export function listVisibleReservations(input: {
  session: SessionUser
  userId?: string | null
  tableId?: string | null
  date?: string | null
}) {
  const effectiveUserId = input.session.role === 'admin' ? input.userId ?? undefined : input.session.id

  return listReservations({
    userId: effectiveUserId,
    tableId: input.tableId ?? undefined,
    date: input.date ?? undefined,
  })
}

export function createReservationForSession(
  session: SessionUser,
  body: { tableId?: unknown; date?: unknown; startTime?: unknown; endTime?: unknown; surface?: unknown },
) {
  const tableId = requireString(body.tableId)
  const date = requireString(body.date)
  const startTime = requireString(body.startTime)
  const endTime = requireString(body.endTime)
  const surface = parseSurface(body.surface)

  if (!tableId || !date || !startTime || !endTime) {
    serviceError('tableId, date, startTime and endTime are required', 400)
  }

  const table = getTableById(tableId)
  if (!table) {
    serviceError('Table not found', 404)
  }
  if (table.type === 'removable_top' && !surface) {
    serviceError('Surface is required for removable top tables', 400)
  }
  if (startTime >= endTime) {
    serviceError('Invalid reservation time range', 400)
  }
  if (hasReservationConflict({ tableId, date, startTime, endTime, surface })) {
    serviceError('Time slot is already reserved', 409)
  }

  return createReservation({
    tableId,
    userId: session.id,
    date,
    startTime,
    endTime,
    surface,
  })
}

export function checkReservationAccess(session: SessionUser, reservationId: string) {
  const existingReservation = findReservationById(reservationId)
  if (!existingReservation) {
    serviceError('Reservation not found', 404)
  }
  if (session.role !== 'admin' && existingReservation.userId !== session.id) {
    serviceError('Forbidden', 403)
  }
}

export function updateReservationForSession(
  session: SessionUser,
  reservationId: string,
  body: { status?: unknown; date?: unknown; startTime?: unknown; endTime?: unknown; surface?: unknown },
) {
  const existingReservation = findReservationById(reservationId)
  if (!existingReservation) {
    serviceError('Reservation not found', 404)
  }
  if (session.role !== 'admin' && existingReservation.userId !== session.id) {
    serviceError('Forbidden', 403)
  }

  const nextStatus = body.status
  if (nextStatus != null && !['active', 'cancelled', 'completed'].includes(String(nextStatus))) {
    serviceError('Invalid reservation status', 400)
  }

  const nextStartTime = body.startTime == null ? existingReservation.startTime : String(body.startTime)
  const nextEndTime = body.endTime == null ? existingReservation.endTime : String(body.endTime)
  const nextDate = body.date == null ? existingReservation.date : String(body.date)
  const nextSurface = body.surface === undefined || body.surface === null
    ? (existingReservation.surface ?? null)
    : (parseSurface(body.surface) ?? (existingReservation.surface ?? null))

  if (nextStartTime >= nextEndTime) {
    serviceError('Invalid reservation time range', 400)
  }
  if (
    hasReservationConflict({
      tableId: existingReservation.tableId,
      date: nextDate,
      startTime: nextStartTime,
      endTime: nextEndTime,
      surface: nextSurface ?? undefined,
      ignoreReservationId: existingReservation.id,
    })
  ) {
    serviceError('Time slot is already reserved', 409)
  }

  const updated = updateReservationById(reservationId, {
    date: nextDate,
    startTime: nextStartTime,
    endTime: nextEndTime,
    surface: nextSurface,
    status: (nextStatus == null ? existingReservation.status : String(nextStatus)) as Reservation['status'],
  })

  if (!updated) {
    serviceError('Reservation not found', 404)
  }

  return updated
}
