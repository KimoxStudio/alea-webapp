// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

/**
 * Smoke test for the lib/db seam (F0-05).
 *
 * This is a pure indirection layer over lib/supabase/server — the goal here
 * is only to lock in that getDb()/getAdminDb() route to the correct
 * underlying factory (user-scoped vs admin) and return distinct clients,
 * so a future regression (e.g. accidentally swapping which factory is
 * called) is caught immediately.
 */
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({ __kind: 'user-scoped' })),
  createSupabaseServerAdminClient: vi.fn(() => ({ __kind: 'admin' })),
}))

describe('lib/db seam', () => {
  it('getDb() resolves via the user-scoped, RLS-respecting factory', async () => {
    const { getDb } = await import('@/lib/db')
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')

    const client = await getDb()

    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1)
    expect(client).toEqual({ __kind: 'user-scoped' })
  })

  it('getAdminDb() resolves via the admin, RLS-bypassing factory', async () => {
    const { getAdminDb } = await import('@/lib/db')
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

    const client = getAdminDb()

    expect(createSupabaseServerAdminClient).toHaveBeenCalledTimes(1)
    expect(client).toEqual({ __kind: 'admin' })
  })

  it('getDb() and getAdminDb() return distinct clients', async () => {
    const { getDb, getAdminDb } = await import('@/lib/db')

    const userClient = await getDb()
    const adminClient = getAdminDb()

    expect(userClient).not.toEqual(adminClient)
  })
})
