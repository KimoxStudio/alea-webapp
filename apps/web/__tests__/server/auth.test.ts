import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

function createMutationRequest(origin = 'http://localhost:3000') {
  const url = `${origin}/api/auth/login`

  return new NextRequest(url, {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin,
    },
  })
}

describe('server auth helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('AUTH_SESSION_SECRET', 'test-secret-with-at-least-32-chars')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.doUnmock('next/headers')
  })

  it('creates and reads a valid session token from the request cookie', async () => {
    const { createSessionToken, getSessionFromRequest } = await import('@/lib/server/auth')
    const token = createSessionToken({ id: '1', role: 'admin' })

    const request = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: {
        cookie: `auth_session=${token}`,
      },
    })

    expect(getSessionFromRequest(request)).toEqual({ id: '1', role: 'admin' })
  })

  it('rejects a token signed with a different secret', async () => {
    const { createSessionToken, getSessionFromRequest } = await import('@/lib/server/auth')
    const token = createSessionToken({ id: '1', role: 'admin' })

    vi.stubEnv('AUTH_SESSION_SECRET', 'another-secret-with-at-least-32-chars')

    const request = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: {
        cookie: `auth_session=${token}`,
      },
    })

    expect(getSessionFromRequest(request)).toBeNull()
  })

  it('sets and clears the session cookie with hardened defaults', async () => {
    const { setSessionCookie, clearSessionCookie } = await import('@/lib/server/auth')
    const loginResponse = NextResponse.json({ ok: true })
    setSessionCookie(loginResponse, { id: '1', role: 'admin' })

    expect(loginResponse.cookies.get('auth_session')?.value).toBeTruthy()

    const logoutResponse = NextResponse.json({ ok: true })
    clearSessionCookie(logoutResponse)

    expect(logoutResponse.cookies.get('auth_session')?.value).toBe('')
    expect(logoutResponse.headers.get('set-cookie')).toContain('HttpOnly')
    expect(logoutResponse.headers.get('set-cookie')).toContain('SameSite=lax')
  })

  it('enforces same-origin for unsafe methods and skips GET requests', async () => {
    const { enforceSameOriginForMutation } = await import('@/lib/server/auth')

    expect(
      enforceSameOriginForMutation(
        new NextRequest('http://localhost:3000/api/auth/me', { method: 'GET' }),
      ),
    ).toBeNull()

    const accepted = enforceSameOriginForMutation(createMutationRequest())
    expect(accepted).toBeNull()

    const rejected = enforceSameOriginForMutation(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'https://attacker.example',
        },
      }),
    )

    expect(rejected?.status).toBe(403)
  })

  it('returns 401/403 responses from requireAuth and requireAdmin when needed', async () => {
    const { createSessionToken, requireAdmin, requireAuth } = await import('@/lib/server/auth')

    const unauthorized = requireAuth(new NextRequest('http://localhost:3000/api/users'))
    expect(unauthorized).toBeInstanceOf(NextResponse)
    expect((unauthorized as NextResponse).status).toBe(401)

    const memberToken = createSessionToken({ id: '2', role: 'member' })
    const forbidden = requireAdmin(
      new NextRequest('http://localhost:3000/api/users', {
        headers: {
          cookie: `auth_session=${memberToken}`,
        },
      }),
    )

    expect(forbidden).toBeInstanceOf(NextResponse)
    expect((forbidden as NextResponse).status).toBe(403)

    const adminToken = createSessionToken({ id: '1', role: 'admin' })
    const admin = requireAdmin(
      new NextRequest('http://localhost:3000/api/users', {
        headers: {
          cookie: `auth_session=${adminToken}`,
        },
      }),
    )

    expect(admin).toEqual({ id: '1', role: 'admin' })
  })

  it('marks cookies as secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const { setSessionCookie } = await import('@/lib/server/auth')
    const response = NextResponse.json({ ok: true })

    setSessionCookie(response, { id: '1', role: 'admin' })

    expect(response.headers.get('set-cookie')).toContain('Secure')
  })

  it('reads the session from server cookies', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'))
    const { createSessionToken } = await import('@/lib/server/auth')
    const token = createSessionToken({ id: '1', role: 'admin' })

    vi.doMock('next/headers', () => ({
      cookies: vi.fn(async () => ({
        get: (name: string) => {
          if (name !== 'auth_session') return undefined

          return {
            value: token,
          }
        },
      })),
    }))

    vi.resetModules()
    const { getSessionFromServerCookies } = await import('@/lib/server/auth')
    expect(await getSessionFromServerCookies()).toEqual({ id: '1', role: 'admin' })
  })
})
