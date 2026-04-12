import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ServiceError } from '@/lib/server/service-error'

// --- Top-level mock functions ---

const requireAdminMock = vi.fn()
const resetNoShowsMock = vi.fn()
const updateUserMock = vi.fn()
const deleteUserMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/server/users-service', () => ({
  resetNoShows: resetNoShowsMock,
  updateUser: updateUserMock,
  deleteUser: deleteUserMock,
}))

vi.mock('@/lib/server/security', () => ({
  enforceMutationSecurity: enforceMutationSecurityMock,
  enforceRateLimit: enforceRateLimitMock,
  RATE_LIMIT_POLICIES: {
    adminMutation: { bucket: 'admin-mutation', limit: 100, windowMs: 60_000 },
  },
}))

// --- Helpers ---

function makeAdminContext(userId = 'admin-user', role: 'admin' | 'member' = 'admin') {
  return {
    session: { id: userId, role },
    applyCookies: (res: NextResponse) => res,
  }
}

function createJsonRequest(
  path: string,
  body?: unknown,
  options?: {
    method?: string
  },
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options?.method ?? 'PATCH',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// --- Tests ---

describe('PATCH /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Security passes by default
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    // Auth passes by default (admin)
    requireAdminMock.mockResolvedValue(makeAdminContext())
    resetNoShowsMock.mockResolvedValue(undefined)
  })

  it('returns 200 when action=reset_no_shows called by admin', async () => {
    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', { action: 'reset_no_shows' }), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(200)
    expect(resetNoShowsMock).toHaveBeenCalledWith('user-123')
    expect(resetNoShowsMock).toHaveBeenCalledOnce()
  })

  it('returns 400 when action is unknown', async () => {
    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', { action: 'unknown_action' }), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ error: 'Unknown action' })
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('returns 400 when action is missing', async () => {
    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', {}), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ error: 'Unknown action' })
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('returns 403 when called by non-admin user', async () => {
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 }),
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', { action: 'reset_no_shows' }), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(403)
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('applies security middleware and returns error when CSRF is invalid', async () => {
    enforceMutationSecurityMock.mockReturnValue(
      NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', { action: 'reset_no_shows' }), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(403)
    expect(requireAdminMock).not.toHaveBeenCalled()
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('applies rate limiting and returns 429 when limit exceeded', async () => {
    enforceRateLimitMock.mockReturnValue(
      NextResponse.json({ message: 'Too Many Requests' }, { status: 429 }),
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', { action: 'reset_no_shows' }), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(429)
    expect(requireAdminMock).not.toHaveBeenCalled()
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })

  it('returns 500 when resetNoShows throws ServiceError', async () => {
    resetNoShowsMock.mockRejectedValue(new ServiceError('Internal server error', 500))

    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', { action: 'reset_no_shows' }), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toMatchObject({ message: 'Internal server error', statusCode: 500 })
  })

  it('returns 401 when requireAdmin returns auth error', async () => {
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
    )

    const { PATCH } = await import('@/app/api/users/[id]/route')

    const response = await PATCH(createJsonRequest('/api/users/user-123', { action: 'reset_no_shows' }), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(401)
    expect(resetNoShowsMock).not.toHaveBeenCalled()
  })
})
