// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ServiceError } from '@/lib/server/service-error'

let requestCounter = 0

const requireAdminMock = vi.fn()
const resetNoShowsMock = vi.fn()
const unblockUserMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/server/users-service', () => ({
  resetNoShows: resetNoShowsMock,
  unblockUser: unblockUserMock,
}))

vi.mock('@/lib/server/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/security')>()
  return {
    ...actual,
    enforceMutationSecurity: enforceMutationSecurityMock,
    enforceRateLimit: enforceRateLimitMock,
    RATE_LIMIT_POLICIES: {
      adminMutation: { bucket: 'admin-mutation', limit: 50, windowMs: 60_000 },
    },
  }
})

function makeAdminContext(userId = 'admin-1', role: 'member' | 'admin' = 'admin') {
  return {
    session: { id: userId, role },
    applyCookies: (res: NextResponse) => res,
  }
}

function createPatchRequest(userId: string, action?: string | null) {
  const url = new URL(`http://localhost:3000/api/users/${userId}`)
  const clientIp = `10.0.0.${requestCounter + 1}`
  requestCounter += 1

  return new NextRequest(url.toString(), {
    method: 'PATCH',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'x-forwarded-for': clientIp,
      'x-real-ip': '127.0.0.1',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ action }),
  })
}

describe('PATCH /api/users/[id]', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    const { resetRateLimitStoreForTests } = await import('@/lib/server/security')
    resetRateLimitStoreForTests()
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '127.0.0.1/32')
    requestCounter = 0
    // Security and auth pass by default
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    requireAdminMock.mockResolvedValue(makeAdminContext())
    resetNoShowsMock.mockResolvedValue(undefined)
    unblockUserMock.mockResolvedValue(undefined)
  })

  it('returns 200 and calls resetNoShows when action is reset_no_shows', async () => {
    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'reset_no_shows'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
    expect(resetNoShowsMock).toHaveBeenCalledWith('user-123')
    expect(unblockUserMock).not.toHaveBeenCalled()
  })

  it('returns 200 and calls unblockUser when action is unblock', async () => {
    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-456', 'unblock'), {
      params: Promise.resolve({ id: 'user-456' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true })
    expect(unblockUserMock).toHaveBeenCalledWith('user-456')
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid action value', async () => {
    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'invalid_action'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toBe('Invalid action')
    expect(resetNoShowsMock).not.toHaveBeenCalled()
    expect(unblockUserMock).not.toHaveBeenCalled()
  })

  it('returns 400 when action is missing or null', async () => {
    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', null as unknown as string), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.message).toBe('Invalid action')
  })

  it('returns 403 when caller is not admin', async () => {
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 })
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'reset_no_shows'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(403)
    expect(resetNoShowsMock).not.toHaveBeenCalled()
    expect(unblockUserMock).not.toHaveBeenCalled()
  })

  it('returns security error and skips auth when enforceMutationSecurity fails', async () => {
    enforceMutationSecurityMock.mockReturnValue(
      NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'reset_no_shows'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(403)
    expect(requireAdminMock).not.toHaveBeenCalled()
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('returns rate limit error and skips auth when rate limit is exceeded', async () => {
    enforceRateLimitMock.mockReturnValue(
      NextResponse.json({ message: 'Too Many Requests' }, { status: 429 })
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'reset_no_shows'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(429)
    expect(requireAdminMock).not.toHaveBeenCalled()
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('returns 500 when resetNoShows throws a service error', async () => {
    resetNoShowsMock.mockRejectedValue(new ServiceError('Internal server error', 500))

    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'reset_no_shows'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(500)
  })

  it('returns 500 when unblockUser throws a service error', async () => {
    unblockUserMock.mockRejectedValue(new ServiceError('Internal server error', 500))

    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'unblock'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(500)
  })

  it('returns 401 when session is missing', async () => {
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 })
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')
    const response = await PATCH(createPatchRequest('user-123', 'reset_no_shows'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(401)
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })
})
