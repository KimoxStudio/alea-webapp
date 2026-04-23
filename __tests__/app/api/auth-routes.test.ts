// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

let requestCounter = 0

const loginMock = vi.fn()
const registerMock = vi.fn()
const logoutWithClientMock = vi.fn()
const getCurrentUserMock = vi.fn()
const exchangeCodeForSessionMock = vi.fn()
const routeGetUserMock = vi.fn()
const routeProfileMaybeSingleMock = vi.fn()
const routeSignInWithPasswordMock = vi.fn()

vi.mock('@/lib/server/auth-service', () => ({
  login: loginMock,
  register: registerMock,
  logoutWithClient: logoutWithClientMock,
  getCurrentUser: getCurrentUserMock,
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseRouteHandlerClient: vi.fn(() => ({
    supabase: {
      auth: {
        exchangeCodeForSession: exchangeCodeForSessionMock,
        getUser: routeGetUserMock,
        signInWithPassword: routeSignInWithPasswordMock,
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: routeProfileMaybeSingleMock,
          })),
        })),
      })),
    },
    applyCookies: (response: NextResponse) => {
      response.cookies.set('sb-access-token', 'test-session')
      return response
    },
  })),
}))

function createJsonRequest(
  path: string,
  body?: unknown,
  options?: {
    method?: string
    origin?: string
    cookie?: string
    csrfToken?: string | null
    fetchSite?: string
    forwardedFor?: string
    realIp?: string
  },
) {
  const origin = options?.origin ?? 'http://localhost:3000'
  const csrfToken = options?.csrfToken === undefined ? 'test-csrf-token' : options.csrfToken
  const cookie = [options?.cookie, csrfToken ? `alea-csrf-token=${csrfToken}` : null]
    .filter(Boolean)
    .join('; ')
  const clientIp = options?.forwardedFor ?? `10.0.0.${requestCounter + 1}`
  const realIp = options?.realIp ?? '127.0.0.1'
  requestCounter += 1

  return new NextRequest(`http://localhost:3000${path}`, {
    method: options?.method ?? 'POST',
    headers: {
      host: 'localhost:3000',
      origin,
      'x-forwarded-for': clientIp,
      'x-real-ip': realIp,
      ...(options?.fetchSite ? { 'sec-fetch-site': options.fetchSite } : {}),
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...(cookie ? { cookie } : {}),
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('auth API routes', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    const { resetRateLimitStoreForTests } = await import('@/lib/server/security')
    resetRateLimitStoreForTests()
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '127.0.0.1/32')
    requestCounter = 0
    loginMock.mockResolvedValue({
      id: 'user-1',
      memberNumber: '100001',
      role: 'admin',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    registerMock.mockResolvedValue({
      id: 'new-user-id',
      memberNumber: '100099',
      role: 'member',
      isActive: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    logoutWithClientMock.mockResolvedValue({ success: true })
    routeGetUserMock.mockResolvedValue({ data: { user: { id: 'user-2' } }, error: null })
    routeProfileMaybeSingleMock.mockResolvedValue({
      data: { id: 'user-2', role: 'member', is_active: true },
      error: null,
    })
    getCurrentUserMock.mockResolvedValue({
      id: 'user-2',
      memberNumber: '100099',
      role: 'member',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })
    exchangeCodeForSessionMock.mockResolvedValue({ data: {}, error: null })
    routeSignInWithPasswordMock.mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null })
  })

  it('logs in and returns the public user payload with Supabase session cookies', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    const response = await POST(
      createJsonRequest('/api/auth/login', {
        identifier: '100001',
        password: 'Admin123',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      id: 'user-1',
      role: 'admin',
    })
    expect(response.cookies.get('sb-access-token')?.value).toBe('test-session')
  })

  it('rejects login requests from a different origin', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    const response = await POST(
      createJsonRequest(
        '/api/auth/login',
        {
          identifier: '100001',
          password: 'Admin123',
        },
        { origin: 'https://attacker.example' },
      ),
    )

    expect(response.status).toBe(403)
  })

  it('rejects login requests with a missing CSRF token', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    const response = await POST(
      createJsonRequest(
        '/api/auth/login',
        {
          identifier: '100001',
          password: 'Admin123',
        },
        { csrfToken: null },
      ),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ message: 'Invalid CSRF token' })
  })

  it('rejects login requests flagged as cross-site by fetch metadata', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    const response = await POST(
      createJsonRequest(
        '/api/auth/login',
        {
          identifier: '100001',
          password: 'Admin123',
        },
        { fetchSite: 'cross-site' },
      ),
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ message: 'Cross-site requests are not allowed' })
  })

  it('maps invalid credentials from the service to a 401 response', async () => {
    const { POST } = await import('@/app/api/auth/login/route')
    const { ServiceError } = await import('@/lib/server/service-error')
    loginMock.mockRejectedValueOnce(new ServiceError('Invalid credentials', 401))

    const response = await POST(
      createJsonRequest('/api/auth/login', {
        identifier: '100001',
        password: 'wrong-password',
      }),
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 401 })
  })

  it('rate limits repeated login attempts from the same client', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await POST(
        createJsonRequest(
          '/api/auth/login',
          {
            identifier: '100001',
            password: 'Admin123',
          },
          { forwardedFor: '203.0.113.10' },
        ),
      )

      expect(response.status).toBe(200)
    }

    const blocked = await POST(
      createJsonRequest(
        '/api/auth/login',
        {
          identifier: '100001',
          password: 'Admin123',
        },
        { forwardedFor: '203.0.113.10' },
      ),
    )

    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBeTruthy()
  })

  it('returns 410 when self-registration is disabled', async () => {
    const { POST } = await import('@/app/api/auth/register/route')

    const response = await POST(
      createJsonRequest('/api/auth/register', {
        memberNumber: '100099',
        password: 'Password123',
      }),
    )

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({
      message: 'Self-registration is disabled. Ask an administrator for an activation link.',
      statusCode: 410,
    })
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('still returns 410 even if a member number is supplied', async () => {
    const { POST } = await import('@/app/api/auth/register/route')

    const response = await POST(
      createJsonRequest('/api/auth/register', {
        memberNumber: '100001',
        password: 'Password123',
      }),
    )

    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 410 })
    expect(registerMock).not.toHaveBeenCalled()
  })

  it('rejects register requests from a different origin before returning 410', async () => {
    const { POST } = await import('@/app/api/auth/register/route')

    const response = await POST(
      createJsonRequest('/api/auth/register', {
        memberNumber: '100099',
        password: 'Password123',
      }, {
        origin: 'https://attacker.example',
      }),
    )

    expect(response.status).toBe(403)
  })

  it('rate limits repeated register attempts from the same client', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const statuses: number[] = []

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await POST(
        createJsonRequest('/api/auth/register', {
          memberNumber: '100099',
          password: 'Password123',
        }, {
          forwardedFor: '203.0.113.99',
        }),
      )

      statuses.push(response.status)
    }

    expect(statuses).toContain(410)
    expect(statuses.at(-1)).toBe(429)
  })

  it('reads the session from /me after login and signs out through the auth routes', async () => {
    const loginRoute = await import('@/app/api/auth/login/route')
    const meRoute = await import('@/app/api/auth/me/route')
    const logoutRoute = await import('@/app/api/auth/logout/route')
    routeGetUserMock.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    routeProfileMaybeSingleMock.mockResolvedValueOnce({
      data: { id: 'user-1', role: 'admin', is_active: true },
      error: null,
    })
    getCurrentUserMock.mockResolvedValueOnce({
      id: 'user-1',
      memberNumber: '100001',
      role: 'admin',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    })

    const loginResponse = await loginRoute.POST(
      createJsonRequest('/api/auth/login', {
        identifier: '100001',
        password: 'Admin123',
      }),
    )

    expect(loginResponse.status).toBe(200)
    expect(loginResponse.cookies.get('sb-access-token')?.value).toBe('test-session')

    const meResponse = await meRoute.GET(new NextRequest('http://localhost:3000/api/auth/me'))
    expect(meResponse.status).toBe(200)
    await expect(meResponse.json()).resolves.toMatchObject({
      memberNumber: '100001',
      role: 'admin',
    })

    const logoutResponse = await logoutRoute.POST(createJsonRequest('/api/auth/logout'))
    expect(logoutResponse.status).toBe(200)
    await expect(logoutResponse.json()).resolves.toEqual({ success: true })
  })

  it('returns 401 from /me when current-user resolution is unauthorized', async () => {
    const { GET } = await import('@/app/api/auth/me/route')
    const { ServiceError } = await import('@/lib/server/service-error')
    getCurrentUserMock.mockRejectedValueOnce(new ServiceError('Unauthorized', 401))

    const response = await GET(new NextRequest('http://localhost:3000/api/auth/me'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 401 })
  })

  it('returns 401 from /me when there is no authenticated session', async () => {
    const { GET } = await import('@/app/api/auth/me/route')
    routeGetUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })

    const response = await GET(new NextRequest('http://localhost:3000/api/auth/me'))

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 401 })
    expect(getCurrentUserMock).not.toHaveBeenCalled()
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

  it('maps logout service failures to a 500 response', async () => {
    const { POST } = await import('@/app/api/auth/logout/route')
    const { ServiceError } = await import('@/lib/server/service-error')
    logoutWithClientMock.mockRejectedValueOnce(new ServiceError('Internal server error', 500))

    const response = await POST(createJsonRequest('/api/auth/logout'))

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 500 })
  })

  it('sanitizes callback redirects and exchanges the PKCE code when present', async () => {
    const { GET } = await import('@/app/api/auth/callback/route')

    const withCode = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?code=pkce-code&next=%2Frooms'),
    )
    expect(exchangeCodeForSessionMock).toHaveBeenCalledWith('pkce-code')
    expect(withCode.headers.get('location')).toBe('http://localhost:3000/rooms')
    expect(withCode.cookies.get('sb-access-token')?.value).toBe('test-session')

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

    const bareSlash = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?next=%2F'),
    )
    expect(bareSlash.headers.get('location')).toBe('http://localhost:3000/')
  })

  it('redirects to a safe error page when the PKCE code exchange fails', async () => {
    const { GET } = await import('@/app/api/auth/callback/route')
    exchangeCodeForSessionMock.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: 'Invalid auth code' },
    })

    const response = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?code=expired-code&next=%2Frooms'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/?authError=callback')
    expect(response.cookies.get('sb-access-token')?.value).toBe('test-session')
  })

  it('redirects to a safe error page when the PKCE exchange throws unexpectedly', async () => {
    const { GET } = await import('@/app/api/auth/callback/route')
    exchangeCodeForSessionMock.mockRejectedValueOnce(new Error('network broke'))

    const response = await GET(
      new NextRequest('http://localhost:3000/api/auth/callback?code=broken-code&next=%2Frooms'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/?authError=callback')
    expect(response.cookies.get('sb-access-token')?.value).toBe('test-session')
  })
})
