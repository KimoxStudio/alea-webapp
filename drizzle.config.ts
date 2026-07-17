import type { Config } from 'drizzle-kit'

/**
 * drizzle-kit config — F1 (docs/MIGRATION-supabase-to-neon.md).
 *
 * This project is not yet cut over to Neon (see F2). This config exists so
 * `drizzle-kit generate` can produce SQL migration files locally from
 * lib/db/schema/*.ts without any live database connection. Do NOT run
 * `drizzle-kit push` or `drizzle-kit migrate` against this config until the
 * F2 cutover is explicitly authorized by the user — those commands connect to
 * a real database.
 *
 * Env vars are referenced by NAME ONLY, never read/printed here:
 *   - POSTGRES_URL              (pooled connection, runtime use)
 *   - POSTGRES_URL_NON_POOLING  (direct connection, used by drizzle-kit itself)
 */
export default {
  schema: './lib/db/schema/index.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL ?? '',
  },
  verbose: true,
  strict: true,
} satisfies Config
