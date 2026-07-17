// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { SessionUser } from '@/lib/server/auth/auth'
import { ServiceError } from '@/lib/server/shared/service-error'

// --- Top-level mock functions ---

const renewSavedGameForSessionMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()
const requireAuthMock = vi.fn()

vi.mock('@/lib/server/games/saved-games-service', () => ({
  renewSavedGameForSession: renewSavedGameForSessionMock,
}))

vi.mock('@/lib/server/shared/security', () => ({
  enforceMutationSecurity: enforceMutationSecurityMock,
  enforceRateLimit: enforceRateLimitMock,
  RATE_LIMIT_POLICIES: {
    reservationMutation: { bucket: 'reservation-mutation', limit: 20, windowMs: 60_000 },
  },
}))

vi.mock('@/lib/server/auth/auth', () => ({
  requireAuth: requireAuthMock,
}))

// --- Helpers ---

function makeAuthContext(userId = 'user-1', role: 'member' | 'admin' = 'member') {
  return {
    session: { id: userId, role } satisfies SessionUser,
    applyCookies: (res: NextResponse) => {
      res.cookies.set('sb-access-token', 'test-session')
      return res
    },
  }
}

function createJsonRequest(
  path: string,
  body?: unknown,
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// --- Tests ---

describe('Saved Games API route: POST /api/saved-games/[id]/renew', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Security passes by default
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    // Auth passes by default
    requireAuthMock.mockResolvedValue(makeAuthContext('user-1', 'member'))
  })

  it('returns 200 with renewed saved game when member renews their own game during renewal window', async () => {
    const mockRenewed = {
      id: 'sg-renewed-1',
      tableId: 'table-1',
      userId: 'user-1',
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      status: 'active' as const,
      attendanceCount: 0,
      renewedFromId: 'sg-1',
      createdAt: '2026-06-19T10:00:00Z',
      updatedAt: '2026-06-19T10:00:00Z',
      tableName: 'Mesa doble',
      roomName: 'Sala',
      renewalOpensOn: '2026-09-16',
      canRenew: false,
    }
    renewSavedGameForSessionMock.mockResolvedValue(mockRenewed)

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-1/renew'),
      { params: Promise.resolve({ id: 'sg-1' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(mockRenewed)
    expect(renewSavedGameForSessionMock).toHaveBeenCalledWith(
      { id: 'user-1', role: 'member' },
      'sg-1',
    )
    expect(response.cookies.get('sb-access-token')?.value).toBe('test-session')
  })

  it('returns 401 when user is not authenticated', async () => {
    requireAuthMock.mockResolvedValue(
      NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
    )

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-1/renew'),
      { params: Promise.resolve({ id: 'sg-1' }) },
    )

    expect(response.status).toBe(401)
    expect(renewSavedGameForSessionMock).not.toHaveBeenCalled()
  })

  it('returns 404 when saved game does not exist', async () => {
    renewSavedGameForSessionMock.mockRejectedValue(new ServiceError('Saved Game not found', 404))

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/nonexistent/renew'),
      { params: Promise.resolve({ id: 'nonexistent' }) },
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 404 })
  })

  it('per-user isolation: member cannot renew another member\'s saved game (403 Forbidden)', async () => {
    // User-1 (member) tries to renew a saved game owned by User-2 (another member)
    // Service checks: if (session.role !== 'admin' && current.user_id !== session.id) -> 403
    renewSavedGameForSessionMock.mockRejectedValue(new ServiceError('Forbidden', 403))
    requireAuthMock.mockResolvedValue(makeAuthContext('user-1', 'member'))

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-foreign/renew'),
      { params: Promise.resolve({ id: 'sg-foreign' }) },
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 403, message: 'Forbidden' })
    // Verify the service was called with the member's session
    expect(renewSavedGameForSessionMock).toHaveBeenCalledWith(
      { id: 'user-1', role: 'member' },
      'sg-foreign',
    )
  })

  it('per-user isolation: admin can renew any saved game (no ownership check)', async () => {
    const mockRenewed = {
      id: 'sg-renewed-2',
      tableId: 'table-1',
      userId: 'user-2', // Different user, but admin can renew it
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      status: 'active' as const,
      attendanceCount: 0,
      renewedFromId: 'sg-2',
      createdAt: '2026-06-19T10:00:00Z',
      updatedAt: '2026-06-19T10:00:00Z',
      tableName: 'Mesa doble',
      roomName: 'Sala',
      renewalOpensOn: '2026-09-16',
      canRenew: false,
    }
    renewSavedGameForSessionMock.mockResolvedValue(mockRenewed)
    requireAuthMock.mockResolvedValue(makeAuthContext('admin-user', 'admin'))

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-2/renew'),
      { params: Promise.resolve({ id: 'sg-2' }) },
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(mockRenewed)
    expect(renewSavedGameForSessionMock).toHaveBeenCalledWith(
      { id: 'admin-user', role: 'admin' },
      'sg-2',
    )
  })

  it('returns 409 when game is not active', async () => {
    renewSavedGameForSessionMock.mockRejectedValue(new ServiceError('SAVED_GAME_NOT_ACTIVE', 409))

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-completed/renew'),
      { params: Promise.resolve({ id: 'sg-completed' }) },
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 409 })
  })

  it('returns 409 when renewal window is not open', async () => {
    renewSavedGameForSessionMock.mockRejectedValue(new ServiceError('SAVED_GAME_RENEWAL_NOT_OPEN', 409))

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-too-early/renew'),
      { params: Promise.resolve({ id: 'sg-too-early' }) },
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 409 })
  })

  it('returns 409 when renewed game already exists from this saved game', async () => {
    renewSavedGameForSessionMock.mockRejectedValue(new ServiceError('SAVED_GAME_ALREADY_RENEWED', 409))

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-already-renewed/renew'),
      { params: Promise.resolve({ id: 'sg-already-renewed' }) },
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 409 })
  })

  it('returns 409 when renewed period conflicts with event', async () => {
    renewSavedGameForSessionMock.mockRejectedValue(new ServiceError('SAVED_GAME_EVENT_CONFLICT', 409))

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-event-conflict/renew'),
      { params: Promise.resolve({ id: 'sg-event-conflict' }) },
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ statusCode: 409 })
  })

  it('rejects mutations with failed CSRF check', async () => {
    enforceMutationSecurityMock.mockReturnValue(
      NextResponse.json({ message: 'Invalid CSRF token' }, { status: 403 }),
    )

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-1/renew'),
      { params: Promise.resolve({ id: 'sg-1' }) },
    )

    expect(response.status).toBe(403)
    expect(renewSavedGameForSessionMock).not.toHaveBeenCalled()
  })

  it('rejects mutations with rate limit violation', async () => {
    enforceRateLimitMock.mockReturnValue(
      NextResponse.json({ message: 'Too many requests' }, { status: 429 }),
    )

    const { POST } = await import('@/app/api/saved-games/[id]/renew/route')
    const response = await POST(
      createJsonRequest('/api/saved-games/sg-1/renew'),
      { params: Promise.resolve({ id: 'sg-1' }) },
    )

    expect(response.status).toBe(429)
    expect(renewSavedGameForSessionMock).not.toHaveBeenCalled()
  })
})
