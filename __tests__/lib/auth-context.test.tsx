import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { User } from '@/lib/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/lib/auth/auth-context'
import { Header } from '@/components/layout/header'

const routerPushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
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
})

describe('AuthProvider adopting a refreshed initialUser (#391)', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset()
    apiClientMock.post.mockReset()
    routerPushMock.mockReset()
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
