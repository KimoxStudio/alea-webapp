import { createSupabaseServerAdminClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'

export async function getDatabaseNow(client?: unknown) {
  const admin = (client ?? createSupabaseServerAdminClient()) as {
    rpc?: (fn: string, args?: unknown) => Promise<{ data?: unknown; error?: unknown } | undefined>
  }

  if (typeof admin.rpc !== 'function') {
    return new Date()
  }

  const response = await admin.rpc('get_database_time')
  if (!response || typeof response !== 'object') {
    return new Date()
  }

  const { data, error } = response

  if (error || !data) {
    serviceError('Internal server error', 500)
  }

  const value = new Date(String(data))
  if (isNaN(value.getTime())) {
    serviceError('Internal server error', 500)
  }

  return value
}
