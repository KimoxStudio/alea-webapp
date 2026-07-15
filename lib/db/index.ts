import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createSupabaseServerAdminClient,
  createSupabaseServerClient,
} from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

/**
 * lib/db — single seam for Postgres access.
 *
 * This is an F0 abstraction seam (see docs/MIGRATION-supabase-to-neon.md):
 * it introduces indirection with zero behavior change so a later phase (F1)
 * can swap the underlying implementation (Supabase -> Drizzle/Neon) without
 * touching call sites again. For F0 this is intentionally a thin wrapper
 * around today's Supabase client factories — not a redesign.
 *
 * Convention (see root CLAUDE.md "Key conventions"): the distinction between
 * a user-scoped, RLS-respecting client and an admin, RLS-bypassing client
 * must be preserved. Service-layer files should import from `lib/db`
 * instead of importing `lib/supabase/server` directly.
 *
 * - `getDb()`      -> user-scoped client. Respects RLS. Use for reads/writes
 *                     that must be scoped to the current session.
 * - `getAdminDb()` -> admin client. Bypasses RLS entirely. Use only for
 *                     server-side operations that the service layer has
 *                     already authorized (ownership + role checks).
 */

export type DbClient = SupabaseClient<Database>
export type AdminDbClient = SupabaseClient<Database>

/** User-scoped, RLS-respecting DB client for Server Components / Route Handlers. */
export async function getDb(): Promise<DbClient> {
  return createSupabaseServerClient()
}

/** Admin DB client. Bypasses RLS — never expose to the browser. */
export function getAdminDb(): AdminDbClient {
  return createSupabaseServerAdminClient()
}
