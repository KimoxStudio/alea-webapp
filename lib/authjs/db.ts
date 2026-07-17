import 'server-only'
import { Pool } from 'pg'

/**
 * lib/authjs/db — direct Postgres connection helper for the Auth.js (NextAuth v5)
 * scaffolding introduced in F1 (see Linear KIM-393..422, Supabase→Neon migration).
 *
 * This is intentionally NOT the same seam as `lib/db` (which still wraps the
 * existing Supabase client for the live GoTrue-based auth flow). Auth.js is
 * parallel, inert scaffolding that will eventually run directly against
 * Neon / Vercel Postgres, without RLS — so it talks to Postgres with a plain
 * `pg` client instead of going through Supabase.
 *
 * Do NOT import Drizzle here: KIM-417 ("Build Drizzle schema vs Neon") is a
 * parallel, independent issue and its schema may not exist yet on this
 * branch. This file only ever issues raw, parameterized SQL.
 *
 * The connection string is read from the `POSTGRES_URL` environment
 * variable (see `POSTGRES_URL_NON_POOLING` for the direct/non-pooled
 * variant, useful for one-off/administrative scripts). Never log, print,
 * or otherwise surface the value of either variable.
 */

let pool: Pool | null = null

/**
 * Lazily creates (and reuses) a single `pg` Pool for the process.
 *
 * Returns `null` when `POSTGRES_URL` is not configured, so callers can fail
 * gracefully instead of throwing during module evaluation — this
 * scaffolding must not crash the app before the target database exists.
 */
export function getAuthDbPool(): Pool | null {
  const connectionString = process.env.POSTGRES_URL

  if (!connectionString) {
    return null
  }

  if (!pool) {
    pool = new Pool({ connectionString })
  }

  return pool
}
