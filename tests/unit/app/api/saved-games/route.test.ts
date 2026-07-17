// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { SessionUser } from '@/lib/server/auth/auth'
import { ServiceError } from '@/lib/server/shared/service-error'

// --- Top-level mock functions ---

const listSavedGamesForSessionMock = vi.fn()
const createSavedGameForSessionMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()
const requireAuthMock = vi.fn()

vi.mock('@/lib/server/games/saved-games-service', () => ({
  listSavedGamesForSession: listSavedGamesForSessionMock,
  createSavedGameForSession: createSavedGameForSessionMock,
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
  method: string = 'GET',
) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

// --- Tests ---

describe('Saved Games API routes: GET and POST /api/saved-games', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Security passes by default
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    // Auth passes by default
    requireAuthMock.mockResolvedValue(makeAuthContext('user-1', 'member'))
  })

  // ===== GET /api/saved-games =====

  describe('GET /api/saved-games', () => {
    it('returns 200 with the member\'s saved games', async () => {
      const mockGames = [
        {
          id: 'sg-1',
          tableId: 'table-1',
          userId: 'user-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
          status: 'active' as const,
          attendanceCount: 2,
          renewedFromId: null,
          createdAt: '2026-06-19T10:00:00Z',
          updatedAt: '2026-06-19T10:00:00Z',
          tableName: 'Mesa doble',
          roomName: 'Sala',
          renewalOpensOn: '2026-09-05',
          canRenew: false,
        },
      ]
      listSavedGamesForSessionMock.mockResolvedValue(mockGames)

      const { GET } = await import('@/app/api/saved-games/route')
      const response = await GET(createJsonRequest('/api/saved-games'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(mockGames)
      expect(listSavedGamesForSessionMock).toHaveBeenCalledWith({ id: 'user-1', role: 'member' })
      expect(response.cookies.get('sb-access-token')?.value).toBe('test-session')
    })

    it('returns 200 with empty array when member has no saved games', async () => {
      listSavedGamesForSessionMock.mockResolvedValue([])

      const { GET } = await import('@/app/api/saved-games/route')
      const response = await GET(createJsonRequest('/api/saved-games'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual([])
    })

    it('returns 401 when user is not authenticated', async () => {
      requireAuthMock.mockResolvedValue(
        NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
      )

      const { GET } = await import('@/app/api/saved-games/route')
      const response = await GET(createJsonRequest('/api/saved-games'))

      expect(response.status).toBe(401)
      expect(listSavedGamesForSessionMock).not.toHaveBeenCalled()
    })

    it('maps service errors to error response', async () => {
      listSavedGamesForSessionMock.mockRejectedValue(new ServiceError('Internal server error', 500))

      const { GET } = await import('@/app/api/saved-games/route')
      const response = await GET(createJsonRequest('/api/saved-games'))

      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ statusCode: 500 })
    })

    it('per-user isolation: member only sees their own saved games (service filters by user_id)', async () => {
      const memberGames = [
        {
          id: 'sg-member-1',
          tableId: 'table-1',
          userId: 'user-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
          status: 'active' as const,
          attendanceCount: 0,
          renewedFromId: null,
          createdAt: '2026-06-19T10:00:00Z',
          updatedAt: '2026-06-19T10:00:00Z',
          tableName: 'Mesa A',
          roomName: 'Sala',
          renewalOpensOn: '2026-09-05',
          canRenew: false,
        },
      ]
      listSavedGamesForSessionMock.mockResolvedValue(memberGames)
      requireAuthMock.mockResolvedValue(makeAuthContext('user-1', 'member'))

      const { GET } = await import('@/app/api/saved-games/route')
      const response = await GET(createJsonRequest('/api/saved-games'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(memberGames)
      // Verify the service was called with the member's session (isolation enforced by service)
      expect(listSavedGamesForSessionMock).toHaveBeenCalledWith({ id: 'user-1', role: 'member' })
    })

    it('admin can see all saved games across all users', async () => {
      const allGames = [
        {
          id: 'sg-1',
          tableId: 'table-1',
          userId: 'user-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
          status: 'active' as const,
          attendanceCount: 0,
          renewedFromId: null,
          createdAt: '2026-06-19T10:00:00Z',
          updatedAt: '2026-06-19T10:00:00Z',
          tableName: 'Mesa A',
          roomName: 'Sala',
          renewalOpensOn: '2026-09-05',
          canRenew: false,
        },
        {
          id: 'sg-2',
          tableId: 'table-2',
          userId: 'user-2',
          startDate: '2026-06-21',
          endDate: '2026-09-20',
          status: 'active' as const,
          attendanceCount: 1,
          renewedFromId: null,
          createdAt: '2026-06-19T10:05:00Z',
          updatedAt: '2026-06-19T10:05:00Z',
          tableName: 'Mesa B',
          roomName: 'Sala',
          renewalOpensOn: '2026-09-06',
          canRenew: false,
        },
      ]
      listSavedGamesForSessionMock.mockResolvedValue(allGames)
      requireAuthMock.mockResolvedValue(makeAuthContext('admin-user', 'admin'))

      const { GET } = await import('@/app/api/saved-games/route')
      const response = await GET(createJsonRequest('/api/saved-games'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(allGames)
      expect(listSavedGamesForSessionMock).toHaveBeenCalledWith({ id: 'admin-user', role: 'admin' })
    })
  })

  // ===== POST /api/saved-games =====

  describe('POST /api/saved-games', () => {
    it('returns 201 with created saved game when payload is valid', async () => {
      const mockCreated = {
        id: 'sg-new-1',
        tableId: 'table-1',
        userId: 'user-1',
        startDate: '2026-06-20',
        endDate: '2026-09-19',
        status: 'active' as const,
        attendanceCount: 0,
        renewedFromId: null,
        createdAt: '2026-06-19T10:00:00Z',
        updatedAt: '2026-06-19T10:00:00Z',
        tableName: 'Mesa doble',
        roomName: 'Sala',
        renewalOpensOn: '2026-09-05',
        canRenew: false,
      }
      createSavedGameForSessionMock.mockResolvedValue(mockCreated)

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual(mockCreated)
      expect(createSavedGameForSessionMock).toHaveBeenCalledWith(
        { id: 'user-1', role: 'member' },
        { tableId: 'table-1', startDate: '2026-06-20', endDate: '2026-09-19' },
      )
      expect(response.cookies.get('sb-access-token')?.value).toBe('test-session')
    })

    it('returns 400 when tableId is missing', async () => {
      createSavedGameForSessionMock.mockRejectedValue(new ServiceError('tableId is required', 400))

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          startDate: '2026-06-20',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ statusCode: 400 })
    })

    it('returns 400 when startDate is invalid', async () => {
      createSavedGameForSessionMock.mockRejectedValue(new ServiceError('startDate must be a valid date', 400))

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: 'invalid-date',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ statusCode: 400 })
    })

    it('returns 400 when endDate is invalid', async () => {
      createSavedGameForSessionMock.mockRejectedValue(new ServiceError('endDate must be a valid date', 400))

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: '2026-06-20',
          endDate: 'not-a-date',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 401 when user is not authenticated', async () => {
      requireAuthMock.mockResolvedValue(
        NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
      )

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(401)
      expect(createSavedGameForSessionMock).not.toHaveBeenCalled()
    })

    it('returns 409 when saved game conflicts (overlapping active game on same table)', async () => {
      createSavedGameForSessionMock.mockRejectedValue(new ServiceError('SAVED_GAME_CONFLICT', 409))

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({ statusCode: 409 })
    })

    it('returns 409 when event conflict exists in date range', async () => {
      createSavedGameForSessionMock.mockRejectedValue(new ServiceError('SAVED_GAME_EVENT_CONFLICT', 409))

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toMatchObject({ statusCode: 409 })
    })

    it('rejects mutations with failed CSRF check', async () => {
      enforceMutationSecurityMock.mockReturnValue(
        NextResponse.json({ message: 'Invalid CSRF token' }, { status: 403 }),
      )

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(403)
      expect(createSavedGameForSessionMock).not.toHaveBeenCalled()
    })

    it('rejects mutations with rate limit violation', async () => {
      enforceRateLimitMock.mockReturnValue(
        NextResponse.json({ message: 'Too many requests' }, { status: 429 }),
      )

      const { POST } = await import('@/app/api/saved-games/route')
      const response = await POST(
        createJsonRequest('/api/saved-games', {
          tableId: 'table-1',
          startDate: '2026-06-20',
          endDate: '2026-09-19',
        }, 'POST'),
      )

      expect(response.status).toBe(429)
      expect(createSavedGameForSessionMock).not.toHaveBeenCalled()
    })
  })
})
