import { act, renderHook, waitFor } from '@testing-library/react'
import type { User } from '@/lib/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerPushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
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
      await result.current.login('admin@alea.club', 'Admin1234!@#')
    })

    expect(result.current.user).toEqual(loggedInUser)

    await act(async () => {
      await result.current.register('100099', 'nuevo@alea.club', 'Password1234!@#')
    })

    expect(result.current.user).toEqual(registeredUser)

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
    expect(routerPushMock).toHaveBeenCalledWith('/')
  })
})
