import { handlers } from '@/lib/authjs/auth'

/**
 * Auth.js (NextAuth v5) route handler — F1 scaffolding only (KIM-416).
 *
 * Deliberately mounted at `/api/authjs/*`, distinct from `/api/auth/*`
 * which is reserved for the existing, live Supabase Auth (GoTrue) flow.
 * Nothing in the app links to or calls this route yet — it is inert until
 * a future cutover issue (KIM-419/420) wires it in.
 *
 * Forced to the Node.js runtime because the Credentials provider talks to
 * Postgres via `pg`, which is not Edge-compatible.
 */
export const runtime = 'nodejs'

export const { GET, POST } = handlers
