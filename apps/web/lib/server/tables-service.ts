import { buildTableAvailability, getTableById } from '@/lib/server/mock-db'
import { serviceError } from '@/lib/server/service-error'

function resolveDate(date?: string | null): string {
  const trimmed = date?.trim()
  return trimmed ? trimmed : new Date().toISOString().split('T')[0]
}

export function getTableAvailability(tableId: string, date?: string | null) {
  const table = getTableById(tableId)
  if (!table) {
    serviceError('Table not found', 404)
  }

  return buildTableAvailability(tableId, resolveDate(date))
}
