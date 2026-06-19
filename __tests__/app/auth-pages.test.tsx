import { describe, it, expect, beforeEach, vi } from 'vitest'

const redirectMock = vi.fn()
const getSessionFromServerCookiesMock = vi.fn()
const getCurrentUserMock = vi.fn()
const markNoShowReservationsMock = vi.fn()

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

vi.mock('@/lib/server/reservations-service', () => ({
  markNoShowReservations: markNoShowReservationsMock,
}))

describe('auth page guards', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    markNoShowReservationsMock.mockResolvedValue(0)
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
    expect(markNoShowReservationsMock).not.toHaveBeenCalled()
  })

  it('rooms page skips expiry processing when there is no session', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce(null)

    const { default: RoomsPage } = await import('@/app/[locale]/rooms/page')
    await RoomsPage({ params: Promise.resolve({ locale: 'es' }) })

    expect(redirectMock).toHaveBeenCalledWith('/es/login')
    expect(getCurrentUserMock).not.toHaveBeenCalled()
    expect(markNoShowReservationsMock).not.toHaveBeenCalled()
  })

  it('rooms page marks expired reservations before rendering for a valid session', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce({ id: 'session-1', role: 'member' })
    getCurrentUserMock.mockResolvedValueOnce({ id: 'user-1' })

    const { default: RoomsPage } = await import('@/app/[locale]/rooms/page')
    await RoomsPage({ params: Promise.resolve({ locale: 'es' }) })

    expect(markNoShowReservationsMock).toHaveBeenCalledOnce()
  })

  it('rooms page propagates expiry failures instead of treating them as stale auth', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce({ id: 'session-1', role: 'member' })
    getCurrentUserMock.mockResolvedValueOnce({ id: 'user-1' })
    markNoShowReservationsMock.mockRejectedValueOnce(new Error('RPC failed'))

    const { default: RoomsPage } = await import('@/app/[locale]/rooms/page')

    await expect(RoomsPage({ params: Promise.resolve({ locale: 'es' }) })).rejects.toThrow('RPC failed')
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('root page redirects valid sessions directly to rooms', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce({ id: 'session-1', role: 'member' })
    getCurrentUserMock.mockResolvedValueOnce({ id: 'user-1' })

    const { default: RootPage } = await import('@/app/page')
    await RootPage()

    expect(redirectMock).toHaveBeenCalledWith('/es/rooms')
  })

  it('root page redirects stale sessions to login', async () => {
    getSessionFromServerCookiesMock.mockResolvedValueOnce({ id: 'session-1', role: 'member' })
    getCurrentUserMock.mockRejectedValueOnce(new Error('stale'))

    const { default: RootPage } = await import('@/app/page')
    await RootPage()

    expect(redirectMock).toHaveBeenCalledWith('/es/login')
  })
})
