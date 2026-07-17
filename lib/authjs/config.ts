import 'server-only'
import Credentials from 'next-auth/providers/credentials'
import type { NextAuthConfig } from 'next-auth'
import { verifyCredentials } from '@/lib/authjs/credentials-user'

/**
 * Auth.js (NextAuth v5) configuration — F1 scaffolding only (KIM-416).
 *
 * This stack is entirely parallel to the existing, live Supabase Auth
 * (GoTrue) flow in `lib/server/auth*.ts` / `app/api/auth/*`. It is NOT
 * wired into any page, layout, or middleware yet — that only happens in a
 * future cutover issue (KIM-419/420). Until then this config is inert and
 * unused by the rest of the app.
 *
 * JWT session strategy is used deliberately: no database session adapter
 * is configured, since that would require the Drizzle schema that
 * KIM-417 is building in parallel and which may not exist on this branch.
 *
 * Requires the `AUTH_SECRET` environment variable to be set (see
 * `.env.example`).
 */
export const authConfig: NextAuthConfig = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : null
        const password = typeof credentials?.password === 'string' ? credentials.password : null

        if (!email || !password) {
          return null
        }

        const user = await verifyCredentials(email, password)

        if (!user) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        }
      },
    }),
  ],
}
