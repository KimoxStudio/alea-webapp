import 'server-only'
import bcrypt from 'bcryptjs'
import { getAuthDbPool } from '@/lib/authjs/db'

export interface AuthJsUser {
  id: string
  email: string
  name?: string | null
}

interface ProfileRow {
  id: string
  email: string
  password_hash: string | null
  full_name: string | null
}

/**
 * Looks up a user by email in the target schema's `profiles` table and
 * verifies the supplied password against `profiles.password_hash`.
 *
 * `password_hash` is expected to be bcryptjs-compatible — see the F2
 * cutover note in Linear KIM-393..422 (Supabase→Neon migration), which copies hashes
 * straight from `auth.users.encrypted_password` with no re-hash.
 *
 * NOTE: `profiles.password_hash` now exists in the F1 Drizzle schema
 * (KIM-417, PR #169 — see `lib/db/schema/profiles.ts` and
 * `lib/db/migrations/0000_fine_magma.sql`), but it is **unpopulated** until
 * the F2 cutover migration runs. Supabase never had this column either,
 * since password hashes live in Supabase-managed
 * `auth.users.encrypted_password` today; the F2 cutover runbook (KIM-419)
 * copies those hashes into `profiles.password_hash` verbatim. Until that
 * cutover happens, every row's `password_hash` is `null`, so this function
 * still returns `null` for every lookup in practice.
 *
 * This is defensive scaffolding: the schema column exists, but the data
 * behind it does not yet. Any failure — connection error, no matching row,
 * a `null` password_hash, or a wrong password — resolves to `null`
 * uniformly so callers can never infer whether a given email exists. This
 * route is also gated 404-by-default behind `AUTH_JS_ENABLED` (see
 * app/api/authjs/[...nextauth]/route.ts) so this code path cannot be
 * reached in any deployed environment before the F2 cutover intentionally
 * enables it.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<AuthJsUser | null> {
  const pool = getAuthDbPool()

  if (!pool) {
    return null
  }

  try {
    const result = await pool.query<ProfileRow>(
      'SELECT id, email, password_hash, full_name FROM profiles WHERE email = $1 LIMIT 1',
      [email]
    )

    const row = result.rows[0]

    if (!row || !row.password_hash) {
      return null
    }

    const passwordMatches = await bcrypt.compare(password, row.password_hash)

    if (!passwordMatches) {
      return null
    }

    return {
      id: row.id,
      email: row.email,
      name: row.full_name,
    }
  } catch {
    // Table may not exist yet, connection may fail, etc. Never leak
    // internals — treat every failure as "no such user" from the caller's
    // perspective.
    return null
  }
}
