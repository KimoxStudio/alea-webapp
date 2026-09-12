'use client'

import { createContext, useContext, useState, useEffect, useCallback, startTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useClerk } from '@clerk/nextjs'
import type { User } from '@/lib/types'
import { apiClient } from '@/lib/api/client'
import { endpoints } from '@/lib/api/endpoints'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (memberNumber: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [isLoading, setIsLoading] = useState(initialUser === undefined)
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const clerk = useClerk()

  const locale = pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] ?? 'es'

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiClient.get<User>(endpoints.auth.me)
      setUser(data)
    } catch { setUser(null) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    if (initialUser !== undefined) return
    checkAuth()
  }, [checkAuth, initialUser])

  // A server-issued `initialUser` only reaches this component through a new
  // render of the parent Server Component (`app/[locale]/layout.tsx`), which
  // `router.refresh()` triggers after login/activation/recovery (#391). That
  // re-render passes a *new* `initialUser` prop, but `user` state was only
  // ever seeded from it once at mount — without this sync, the prop change
  // is silently dropped and the header stays stuck on the stale
  // unauthenticated value.
  useEffect(() => {
    if (initialUser !== undefined) setUser(initialUser)
  }, [initialUser])

  const login = async (identifier: string, password: string) => {
    const data = await apiClient.post<User>(endpoints.auth.login, { identifier, password })
    setUser(data)
  }
  const logout = async () => {
    // #397, corrected root cause (found via Playwright verification against
    // a real dev server — the originally-suspected push()/refresh() timing
    // race turned out not to be the actual cause; see PR description):
    // `apiClient.post(endpoints.auth.logout)` only revokes the session on
    // Clerk's backend (`lib/server/auth-service.ts` -> `revokeSession()`).
    // That stops the session from being *refreshed*, but the short-lived
    // `__session` JWT cookie Clerk's middleware verifies locally (no
    // per-request revocation check) stays valid until it naturally expires
    // — verified empirically: `/api/rooms` kept returning 200 for
    // authenticated requests for a window right after the logout POST
    // resolved. `clerk.signOut()` clears that cookie client-side
    // immediately, which is what actually ends the session on this request
    // — the backend revoke alone does not.
    //
    // Order matters: the backend POST must run FIRST, while the session
    // cookie is still present — `getClerkSession()` (used by
    // `lib/server/auth-service.ts`'s logout handler) reads that cookie, and
    // if `clerk.signOut()` already cleared it client-side, the server sees
    // no session and short-circuits without ever calling `revokeSession()`.
    // This also means a POST failure (rate limit, CSRF expiry, network)
    // aborts here, before the session is touched client-side — leaving the
    // user's state consistent (still logged in) rather than a session that's
    // dead client-side but stuck showing authenticated content.
    await apiClient.post(endpoints.auth.logout)
    await clerk.signOut()
    setUser(null)
    // TanStack Query's client-side cache (staleTime, lib/providers.tsx)
    // otherwise keeps rendering protected data fetched before logout —
    // verified via Playwright: without this clear, a previously-loaded room
    // list stayed on screen (with the header correctly gone) after
    // "Cerrar Sesión", matching the original #397 evidence.
    queryClient.clear()
    startTransition(() => {
      router.push(`/${locale}/login`)
      router.refresh()
    })
  }
  const register = async (memberNumber: string, password: string) => {
    const data = await apiClient.post<User>(endpoints.auth.register, { memberNumber, password })
    setUser(data)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

// AUTH_FALLBACK is used when useAuth() is called outside AuthProvider.
// Promise.reject is used explicitly (rather than async + throw) so the rejection
// is always async regardless of whether the caller awaits the return value.
const AUTH_FALLBACK: AuthContextValue = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  login: () => Promise.reject(new Error('useAuth must be used within AuthProvider')),
  logout: () => Promise.reject(new Error('useAuth must be used within AuthProvider')),
  register: () => Promise.reject(new Error('useAuth must be used within AuthProvider')),
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  return ctx ?? AUTH_FALLBACK
}
