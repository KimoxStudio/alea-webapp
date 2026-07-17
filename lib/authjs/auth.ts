import 'server-only'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/authjs/config'

/**
 * Auth.js (NextAuth v5) entry point — F1 scaffolding only (KIM-416).
 *
 * Exposes the route handlers plus the `auth()` / `signIn()` / `signOut()`
 * helpers for a future cutover to consume. Nothing in the app imports these
 * yet — see `lib/authjs/config.ts` for why.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
