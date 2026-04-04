import { serviceError } from '@/lib/server/service-error'

export function resolveDate(date: string | null | undefined): string {
  const today = new Date().toISOString().split('T')[0]
  if (!date || date.trim() === '') return today
  const trimmed = date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw serviceError('Date must be in YYYY-MM-DD format', 400)
  }
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) {
    throw serviceError('Invalid date value', 400)
  }
  return trimmed
}
