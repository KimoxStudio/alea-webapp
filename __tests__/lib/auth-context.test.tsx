import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { User } from '@/lib/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth/auth-context'
import { Header } from '@/components/layout/header'

const routerPushMock = vi.fn()
const routerRefreshMock = vi.fn()

// #397 (residual race): `push()` and `refresh()` must be batched inside a
// single React transition, not fired as two un-batched router updates —
// see auth-context.tsx's `logout()` comment for why. `next/navigation`'s
// test router is synchronous, so it can't reproduce the actual timing race
// (that needs real Playwright verification against a dev server); what a
// unit test *can* prove is that the implementation actually routes both
// calls through `startTransition` rather than calling them directly.
// React's module namespace isn't spy-able directly under Vitest's ESM
// handling ("Cannot redefine property"), so this wraps the real
// `startTransition` via `vi.mock` instead of `vi.spyOn`.
const startTransitionSpy = vi.hoisted(() => vi.fn())
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    startTransition: (callback: () => void) => {
      startTransitionSpy(callback)
      actual.startTransition(callback)
    },
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock, refresh: routerRefreshMock }),
  usePathname: () => '/es/rooms',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  apiClient: apiClientMock,
}))

// #397 (corrected root cause): logout() must clear Clerk's client-side
// session (`useClerk().signOut()`) — the backend-only `revokeSession()` call
// (lib/server/auth-service.ts) stops the session being *refreshed* but
// leaves the short-lived `__session` JWT valid client-side until it expires
// on its own, verified empirically (see PR description) as still-200
// responses from a protected API route right after logout. It must also
// clear TanStack Query's cache (`queryClient.clear()`) so protected data
// fetched before logout doesn't keep rendering.
const clerkSignOutMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut: clerkSignOutMock }),
}))

const queryClientClearMock = vi.fn()
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ clear: queryClientClearMock }),
}))

function createUser(overrides?: Partial<User>): User {
  return {
    id: '1',
    memberNumber: '100001',
    role: 'admin',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('AuthProvider', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset()
    apiClientMock.post.mockReset()
    routerPushMock.mockReset()
    routerRefreshMock.mockReset()
    startTransitionSpy.mockClear()
    clerkSignOutMock.mockClear()
    clerkSignOutMock.mockResolvedValue(undefined)
    queryClientClearMock.mockReset()
  })

  it('hydrates from /auth/me when no initial user is provided', async () => {
    const user = createUser()
    apiClientMock.get.mockResolvedValueOnce(user)

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toEqual(user)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('falls back to an unauthenticated state when /auth/me fails', async () => {
    apiClientMock.get.mockRejectedValueOnce(new Error('Unauthorized'))

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('uses the provided initial user without calling /auth/me', async () => {
    const user = createUser({ role: 'member' })

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialUser={user}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.user).toEqual(user)
    expect(apiClientMock.get).not.toHaveBeenCalled()
  })

  it('updates the auth state on login, register, and logout', async () => {
    const loggedInUser = createUser()
    const registeredUser = createUser({
      id: '2',
      memberNumber: '100099',
      role: 'member',
    })

    apiClientMock.post
      .mockResolvedValueOnce(loggedInUser)
      .mockResolvedValueOnce(registeredUser)
      .mockResolvedValueOnce(undefined)

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialUser={null}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.login('admin@alea.club', 'Admin123')
    })

    expect(result.current.user).toEqual(loggedInUser)

    await act(async () => {
      await result.current.register('100099', 'Password123')
    })

    expect(result.current.user).toEqual(registeredUser)

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(routerPushMock).toHaveBeenCalledWith('/es/login')
  })

  // #397 corrected root cause: the backend-only session revoke does not
  // clear the client-side Clerk session — `clerk.signOut()` is what
  // actually ends it (verified via Playwright, see PR description).
  it('calls clerk.signOut() and clears the query cache on logout (#397)', async () => {
    apiClientMock.post.mockResolvedValueOnce(undefined)

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialUser={createUser()}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.logout()
    })

    expect(clerkSignOutMock).toHaveBeenCalledTimes(1)
    expect(queryClientClearMock).toHaveBeenCalledTimes(1)
  })

  // The backend POST must run BEFORE clerk.signOut(): the server's logout
  // handler (lib/server/auth-service.ts -> getClerkSession() ->
  // revokeSession()) reads the session cookie, and if signOut() already
  // cleared it client-side first, the server sees no session and
  // short-circuits without ever revoking it server-side. Pinned here so
  // this can't silently flip back — either order made the tests above pass.
  it('calls apiClient.post(logout) before clerk.signOut()', async () => {
    apiClientMock.post.mockResolvedValueOnce(undefined)

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialUser={createUser()}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.logout()
    })

    expect(apiClientMock.post.mock.invocationCallOrder[0]).toBeLessThan(
      clerkSignOutMock.mock.invocationCallOrder[0],
    )
  })

  // Regression test for #397: logout navigated away with `router.push()` but
  // never called `router.refresh()`, unlike `login()` (#391). Without the
  // refresh, the App Router can serve a cached RSC payload fetched while
  // still authenticated (e.g. a prefetched `/rooms`) instead of re-running
  // the server layout against the now-cleared session cookie, leaving stale
  // authenticated content on screen after logout.
  it('calls both router.push and router.refresh on logout (#397)', async () => {
    apiClientMock.post.mockResolvedValueOnce(undefined)

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialUser={createUser()}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.logout()
    })

    expect(routerPushMock).toHaveBeenCalledWith('/es/login')
    expect(routerRefreshMock).toHaveBeenCalledTimes(1)
    expect(routerPushMock.mock.invocationCallOrder[0]).toBeLessThan(
      routerRefreshMock.mock.invocationCallOrder[0],
    )
  })

  // Residual #397 race: push()+refresh() being two separate, un-batched
  // router updates left a window where refresh()'s re-fetch of the
  // still-current route could resolve after push() and win. The fix batches
  // both inside one `startTransition`. This only proves the implementation
  // routes both calls through `startTransition` — the actual timing race
  // this fixes cannot be reproduced against `next/navigation`'s synchronous
  // test router and needs real Playwright verification against a dev
  // server.
  it('batches push and refresh inside a single startTransition on logout (#397 race)', async () => {
    apiClientMock.post.mockResolvedValueOnce(undefined)

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialUser={createUser()}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await result.current.logout()
    })

    expect(startTransitionSpy).toHaveBeenCalledTimes(1)
    // The router call must happen inside the transition's callback, not
    // before it runs.
    expect(routerPushMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      startTransitionSpy.mock.invocationCallOrder[0],
    )
  })

  // If the backend logout request fails, the session must be left
  // untouched: no clerk.signOut(), no cache clear, no navigation. Since the
  // POST now runs before clerk.signOut() (see the ordering test above), a
  // POST failure aborts before the client-side session is ever touched —
  // otherwise a POST failure would leave a genuinely dead Clerk session
  // behind a UI that still shows the user as logged in, which is the same
  // symptom shape #397 originally reported, just triggered a different way.
  it('does not touch the client session or navigate when the logout request fails', async () => {
    apiClientMock.post.mockRejectedValueOnce(new Error('Network error'))

    const { AuthProvider, useAuth } = await import('@/lib/auth/auth-context')
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialUser={createUser()}>{children}</AuthProvider>
    )

    const { result } = renderHook(() => useAuth(), { wrapper })

    await act(async () => {
      await expect(result.current.logout()).rejects.toThrow('Network error')
    })

    expect(clerkSignOutMock).not.toHaveBeenCalled()
    expect(queryClientClearMock).not.toHaveBeenCalled()
    expect(routerPushMock).not.toHaveBeenCalled()
    expect(routerRefreshMock).not.toHaveBeenCalled()
    expect(result.current.user).toEqual(createUser())
  })
})

describe('AuthProvider adopting a refreshed initialUser (#391)', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset()
    apiClientMock.post.mockReset()
    routerPushMock.mockReset()
    routerRefreshMock.mockReset()
  })

  // This is the actual user-visible bug: `router.refresh()` alone re-runs the
  // layout and produces a new `initialUser`, but `AuthProvider` previously
  // only read `initialUser` once at mount (`useState(initialUser ?? null)`)
  // with no effect syncing later prop changes into state. So even after the
  // refresh, `user` (and therefore `isAuthenticated`) stayed stuck on the
  // stale unauthenticated value and `Header` kept returning null. Simulating
  // exactly that prop transition — `initialUser={null}` then rerendered with
  // an admin user, the same shape a `router.refresh()`-driven layout
  // re-render produces — is what proves the header (and the admin link)
  // actually reappears.
  it('renders the header and admin nav link once initialUser transitions from null to an admin user', () => {
    const { rerender } = render(
      <AuthProvider initialUser={null}>
        <Header locale="es" />
      </AuthProvider>,
    )

    expect(screen.queryByRole('navigation', { name: 'nav.mainNavAriaLabel' })).not.toBeInTheDocument()

    rerender(
      <AuthProvider initialUser={createUser()}>
        <Header locale="es" />
      </AuthProvider>,
    )

    const desktopNav = screen.getByRole('navigation', { name: 'nav.mainNavAriaLabel' })
    expect(desktopNav).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'nav.admin' })).toBeInTheDocument()
  })

  // The reverse transition. The `useEffect` guard is
  // `if (initialUser !== undefined) setUser(initialUser)`, which must adopt
  // `null` just as readily as a `User` — a `router.refresh()` after the
  // server-side session is gone (expiry, logout elsewhere, admin revoke)
  // delivers `initialUser={null}` and has to clear the header. A guard
  // weakened to `if (initialUser)` would drop this branch silently and leave
  // the admin nav visible to a session that no longer exists.
  it('hides the header once initialUser transitions from an admin user back to null', () => {
    const { rerender } = render(
      <AuthProvider initialUser={createUser()}>
        <Header locale="es" />
      </AuthProvider>,
    )

    expect(screen.getByRole('navigation', { name: 'nav.mainNavAriaLabel' })).toBeInTheDocument()

    rerender(
      <AuthProvider initialUser={null}>
        <Header locale="es" />
      </AuthProvider>,
    )

    expect(screen.queryByRole('navigation', { name: 'nav.mainNavAriaLabel' })).not.toBeInTheDocument()
  })
})
