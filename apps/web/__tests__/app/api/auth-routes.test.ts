import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

function createJsonRequest(
  path: string,
  body?: unknown,
  options?: {
    method?: string
    origin?: string
    cookie?: string
  },
) {
  const origin = options?.origin ?? 'http://localhost:3000'

  return new NextRequest(`${origin}${path}`, {
    method: options?.method ?? 'POST',
    headers: {
      host: 'localhost:3000',
      origin,
      ...(options?.cookie ? { cookie: options.cookie } : {}),
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('auth API routes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('AUTH_SESSION_SECRET', 'test-secret-with-at-least-32-chars')
  })

  it('logs in and returns the public user payload with a session cookie', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    const response = await POST(
      createJsonRequest('/api/auth/login', {
        identifier: 'admin@alea.club',
        password: 'Admin1234!@#',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: '1',
      role: 'admin',
      email: 'admin@alea.club',
    })
    expect(response.cookies.get('auth_session')?.value).toBeTruthy()
  })

  it('rejects login requests from a different origin', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    const response = await POST(
      createJsonRequest(
        '/api/auth/login',
        {
          identifier: 'admin@alea.club',
          password: 'Admin1234!@#',
        },
        { origin: 'https://attacker.example' },
      ),
    )

    expect(response.status).toBe(403)
  })

  it('returns 401 for invalid credentials', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    const response = await POST(
      createJsonRequest('/api/auth/login', {
        identifier: 'admin@alea.club',
        password: 'wrong-password',
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 401 })
  })

  it('returns 409 when registering an email that already exists', async () => {
    const { POST } = await import('@/app/api/auth/register/route')

    const response = await POST(
      createJsonRequest('/api/auth/register', {
        memberNumber: '100123',
        email: 'admin@alea.club',
        password: 'Password1234!@#',
      }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 409 })
  })

  it('registers a user, reads it from /me, and clears the cookie on logout', async () => {
    const registerRoute = await import('@/app/api/auth/register/route')
    const meRoute = await import('@/app/api/auth/me/route')
    const logoutRoute = await import('@/app/api/auth/logout/route')

    const registerResponse = await registerRoute.POST(
      createJsonRequest('/api/auth/register', {
        memberNumber: '100099',
        email: 'nuevo@alea.club',
        password: 'Password1234!@#',
      }),
    )

    expect(registerResponse.status).toBe(201)

    const sessionCookie = registerResponse.cookies.get('auth_session')
    expect(sessionCookie?.value).toBeTruthy()

    const meResponse = await meRoute.GET(
      new NextRequest('http://localhost:3000/api/auth/me', {
        headers: {
          cookie: `${sessionCookie?.name}=${sessionCookie?.value}`,
        },
      }),
    )

    expect(meResponse.status).toBe(200)
    await expect(meResponse.json()).resolves.toMatchObject({
      memberNumber: '100099',
      email: 'nuevo@alea.club',
      role: 'member',
    })

    const logoutResponse = await logoutRoute.POST(
      createJsonRequest('/api/auth/logout', undefined, {
        cookie: `${sessionCookie?.name}=${sessionCookie?.value}`,
      }),
    )

    expect(logoutResponse.status).toBe(200)
    await expect(logoutResponse.json()).resolves.toEqual({ success: true })
    expect(logoutResponse.cookies.get('auth_session')?.value).toBe('')
  })

  it('returns 401 from /me when the session cookie is missing', async () => {
    const { GET } = await import('@/app/api/auth/me/route')

    const response = await GET(new NextRequest('http://localhost:3000/api/auth/me'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 401 })
  })

  it('rejects logout requests from a different origin', async () => {
    const { POST } = await import('@/app/api/auth/logout/route')

    const response = await POST(
      createJsonRequest('/api/auth/logout', undefined, {
        origin: 'https://attacker.example',
      }),
    )

    expect(response.status).toBe(403)
  })

  it('sanitizes callback redirects and keeps valid relative paths', async () => {
    const { GET } = await import('@/app/api/auth/callback/route')

    const withCode = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?code=pkce-code&next=%2Frooms'),
    )
    expect(withCode.headers.get('location')).toBe('http://localhost:3000/rooms')

    const accepted = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?next=%2Frooms'),
    )
    expect(accepted.headers.get('location')).toBe('http://localhost:3000/rooms')

    const rejected = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?next=https://evil.example'),
    )
    expect(rejected.headers.get('location')).toBe('http://localhost:3000/')

    const sanitized = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?next=%2Frooms%0Aevil'),
    )
    expect(sanitized.headers.get('location')).toBe('http://localhost:3000/')
  })
})
