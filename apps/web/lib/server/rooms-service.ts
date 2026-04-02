import { buildTableAvailability, createRoom, getRoomTables, listRooms, updateRoomById } from '@/lib/server/mock-db'
import { serviceError } from '@/lib/server/service-error'

function resolveDate(date?: string | null): string {
  const trimmed = date?.trim()
  return trimmed ? trimmed : new Date().toISOString().split('T')[0]
}

export function listAllRooms() {
  return listRooms()
}

export function createRoomEntry(body: { name?: unknown; tableCount?: unknown; description?: unknown }) {
  const name = String(body.name ?? '').trim()
  if (!name) {
    serviceError('Room name is required', 400)
  }

  return createRoom({
    name,
    tableCount: Number(body.tableCount ?? 0),
    description: body.description ? String(body.description) : undefined,
  })
}

export function updateRoom(id: string, body: { name?: unknown; description?: unknown; tableCount?: unknown }) {
  // Silently strip tableCount — it is not updatable, but we don't error to avoid breaking clients
  const { tableCount: _ignored, ...rest } = body

  const updated = updateRoomById(id, {
    name: rest.name ? String(rest.name) : undefined,
    description: rest.description === undefined ? undefined : String(rest.description),
  })

  if (!updated) {
    serviceError('Room not found', 404)
  }

  return updated
}

export function listRoomTables(roomId: string) {
  return getRoomTables(roomId)
}

export function getRoomTablesAvailability(roomId: string, date?: string | null) {
  const effectiveDate = resolveDate(date)
  const tables = getRoomTables(roomId)

  return tables.reduce<Record<string, ReturnType<typeof buildTableAvailability>>>((acc, table) => {
    acc[table.id] = buildTableAvailability(table.id, effectiveDate)
    return acc
  }, {})
}
