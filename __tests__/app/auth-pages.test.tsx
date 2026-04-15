import { describe, it, expect, beforeEach, vi } from 'vitest'

const redirectMock = vi.fn()
const getSessionFromServerCookiesMock = vi.fn()
const getCurrentUserMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => ((key: string) => key)),
}))

vi.mock('@/lib/server/auth', () => ({
  getSessionFromServerCookies: getSessionFromServerCookiesMock,
}))

vi.mock('@/lib/server/auth-service', () => ({
  getCurrentUser: getCurrentUserMock,
}))

describe('auth page guards', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('login page keeps stale sessions on login instead of redirecting to rooms', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce({ id: 'session-1', role: 'member' })
    getCurrentUserMock.mockRejectedValueOnce(new Error('stale'))

    const { default: LoginPage } = await import('@/app/[locale]/login/page')
    await LoginPage({ params: Promise.resolve({ locale: 'es' }) })

    expect(redirectMock).not.toHaveBeenCalledWith('/es/rooms')
  })

  it('login page redirects valid sessions to rooms', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce({ id: 'session-1', role: 'member' })
    getCurrentUserMock.mockResolvedValueOnce({ id: 'user-1' })

    const { default: LoginPage } = await import('@/app/[locale]/login/page')
    await LoginPage({ params: Promise.resolve({ locale: 'es' }) })

    expect(redirectMock).toHaveBeenCalledWith('/es/rooms')
  })

  it('rooms page redirects stale sessions to login', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce({ id: 'session-1', role: 'member' })
    getCurrentUserMock.mockRejectedValueOnce(new Error('stale'))

    const { default: RoomsPage } = await import('@/app/[locale]/rooms/page')
    await RoomsPage({ params: Promise.resolve({ locale: 'es' }) })

    expect(redirectMock).toHaveBeenCalledWith('/es/login')
  })
})
