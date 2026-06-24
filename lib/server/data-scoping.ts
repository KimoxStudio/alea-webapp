import { serviceError } from '@/lib/server/service-error'
import type { SessionUser } from '@/lib/server/auth'

/**
 * Defense-in-depth for member-scoped reads. The query SHOULD already filter
 * by user_id; this verifies the invariant a second time, independent of the
 * query builder, so a regression in the filter cannot leak another member's
 * rows. Admins are exempt (they legitimately read across users).
 */
export function assertMemberRowsScoped<T extends { user_id: string }>(
  rows: T[],
  session: SessionUser,
): T[] {
  if (session.role !== 'admin' && rows.some((r) => r.user_id !== session.id)) {
    serviceError('Data isolation violation: member read returned foreign rows', 500)
  }
  return rows
}
