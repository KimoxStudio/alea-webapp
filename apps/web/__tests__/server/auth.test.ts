import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const routeGetUser = vi.fn()
const serverGetUser = vi.fn()
const profileMaybeSingle = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseRouteHandlerClient: vi.fn(() => ({
    supabase: {
      auth: {
        getUser: routeGetUser,
      },
    },
    applyCookies: (response: NextResponse) => response,
  })),
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      getUser: serverGetUser,
    },
  })),
  createSupabaseServerAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: profileMaybeSingle,
        })),
      })),
    })),
  })),
}))

function withSession(userId = 'user-1', role: 'member' | 'admin' = 'admin') {
  const authResult = { data: { user: { id: userId } }, error: null }
  const profileResult = {
    data: {
      id: userId,
      role,
      email: 'admin@alea.club',
      member_number: '100001',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z',
    },
    error: null,
  }
  routeGetUser.mockResolvedValue(authResult)
  serverGetUser.mockResolvedValue(authResult)
  profileMaybeSingle.mockResolvedValue(profileResult)
}

describe('server auth helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    routeGetUser.mockResolvedValue({ data: { user: null }, error: null })
    serverGetUser.mockResolvedValue({ data: { user: null }, error: null })
    profileMaybeSingle.mockResolvedValue({ data: null, error: null })
  })

  it('reads the session from a request-scoped Supabase client', async () => {
    withSession('user-1', 'admin')
    const { getSessionFromRequest } = await import('@/lib/server/auth')

    await expect(
      getSessionFromRequest(new NextRequest('http://localhost:3000/api/auth/me')),
    ).resolves.toEqual({ id: 'user-1', role: 'admin' })
  })

  it('reads the session from server cookies for SSR hydration', async () => {
    withSession('user-2', 'member')
    const { getSessionFromServerCookies } = await import('@/lib/server/auth')

    await expect(getSessionFromServerCookies()).resolves.toEqual({
      id: 'user-2',
      role: 'member',
    })
  })

  it('returns null when the profile lookup fails after a valid auth session', async () => {
    routeGetUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    profileMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'db failed' } })
    const { getSessionFromRequest } = await import('@/lib/server/auth')

    await expect(
      getSessionFromRequest(new NextRequest('http://localhost:3000/api/auth/me')),
    ).resolves.toBeNull()
  })

  it('returns 401 from requireAuth when no Supabase user is present', async () => {
    const { requireAuth } = await import('@/lib/server/auth')

    const response = await requireAuth(new NextRequest('http://localhost:3000/api/users'))
    expect(response).toBeInstanceOf(NextResponse)
    expect((response as NextResponse).status).toBe(401)
  })

  it('returns 403 from requireAdmin for authenticated members', async () => {
    withSession('user-2', 'member')
    const { requireAdmin } = await import('@/lib/server/auth')

    const response = await requireAdmin(new NextRequest('http://localhost:3000/api/users'))
    expect(response).toBeInstanceOf(NextResponse)
    expect((response as NextResponse).status).toBe(403)
  })

  it('returns the session user from requireAdmin for admins', async () => {
    withSession('user-1', 'admin')
    const { requireAdmin } = await import('@/lib/server/auth')

    await expect(
      requireAdmin(new NextRequest('http://localhost:3000/api/users')),
    ).resolves.toEqual({ id: 'user-1', role: 'admin' })
  })

  it('enforces same-origin for unsafe methods and skips GET requests', async () => {
    const { enforceSameOriginForMutation } = await import('@/lib/server/auth')

    expect(
      enforceSameOriginForMutation(
        new NextRequest('http://localhost:3000/api/auth/me', { method: 'GET' }),
      ),
    ).toBeNull()

    expect(
      enforceSameOriginForMutation(
        new NextRequest('http://localhost:3000/api/auth/login', {
          method: 'POST',
          headers: {
            origin: 'http://localhost:3000',
          },
        }),
      ),
    ).toBeNull()

    const schemeMismatch = enforceSameOriginForMutation(
      new NextRequest('https://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          origin: 'http://localhost:3000',
        },
      }),
    )

    expect(schemeMismatch?.status).toBe(403)

    const rejected = enforceSameOriginForMutation(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example',
        },
      }),
    )

    expect(rejected?.status).toBe(403)

    const missingOrigin = enforceSameOriginForMutation(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
      }),
    )
    expect(missingOrigin?.status).toBe(403)

    const malformedOrigin = enforceSameOriginForMutation(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          origin: 'not-a-valid-origin',
        },
      }),
    )
    expect(malformedOrigin?.status).toBe(403)
  })
})
