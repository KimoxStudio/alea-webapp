import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ServiceError } from '@/lib/server/service-error'

// --- Top-level mock functions ---

const requireAuthMock = vi.fn()
const requireAdminMock = vi.fn()
const createEventMock = vi.fn()
const listEventsMock = vi.fn()
const updateEventMock = vi.fn()
const deleteEventMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAuth: requireAuthMock,
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/server/events-service', () => ({
  createEvent: createEventMock,
  listEvents: listEventsMock,
  updateEvent: updateEventMock,
  deleteEvent: deleteEventMock,
}))

vi.mock('@/lib/server/security', () => ({
  enforceMutationSecurity: enforceMutationSecurityMock,
  enforceRateLimit: enforceRateLimitMock,
  RATE_LIMIT_POLICIES: {
    adminMutation: { bucket: 'admin-mutation', limit: 20, windowMs: 60_000 },
  },
}))

// --- Helpers ---

function makeAuthContext(userId = 'user-abc', role: 'member' | 'admin' = 'member') {
  return {
    session: { id: userId, role },
    applyCookies: (res: NextResponse) => res,
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

describe('Events API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Security passes by default
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    // Auth passes by default
    requireAuthMock.mockResolvedValue(makeAuthContext())
    requireAdminMock.mockResolvedValue(makeAuthContext('user-admin', 'admin'))
  })

  // ===== GET /api/events =====

  describe('GET /api/events', () => {
    it('returns 200 with list of events for authenticated user', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
          description: 'RPG session',
          createdBy: 'user-admin',
          createdAt: '2026-04-12T10:00:00Z',
          roomBlocks: [],
        },
      ]
      listEventsMock.mockResolvedValue(mockEvents)

      const { GET } = await import('@/app/api/events/route')
      const response = await GET(createJsonRequest('/api/events'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(mockEvents)
      expect(listEventsMock).toHaveBeenCalledTimes(1)
    })

    it('returns 401 when user is not authenticated', async () => {
      requireAuthMock.mockResolvedValue(
        NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
      )

      const { GET } = await import('@/app/api/events/route')
      const response = await GET(createJsonRequest('/api/events'))

      expect(response.status).toBe(401)
      expect(listEventsMock).not.toHaveBeenCalled()
    })

    it('returns empty array when no events exist', async () => {
      listEventsMock.mockResolvedValue([])

      const { GET } = await import('@/app/api/events/route')
      const response = await GET(createJsonRequest('/api/events'))

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual([])
    })

    it('maps service errors to error response', async () => {
      listEventsMock.mockRejectedValue(new ServiceError('Internal server error', 500))

      const { GET } = await import('@/app/api/events/route')
      const response = await GET(createJsonRequest('/api/events'))

      expect(response.status).toBe(500)
    })
  })

  // ===== POST /api/events =====

  describe('POST /api/events', () => {
    it('returns 201 with created event when payload is valid', async () => {
      const mockEvent = {
        id: 'event-new-1',
        title: 'Game Night',
        description: 'RPG session',
        date: '2026-04-20',
        startTime: '19:00',
        endTime: '23:00',
        createdBy: 'user-admin',
        createdAt: '2026-04-12T10:00:00Z',
        roomBlocks: [],
      }
      createEventMock.mockResolvedValue(mockEvent)

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          description: 'RPG session',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(201)
      await expect(response.json()).resolves.toEqual(mockEvent)
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Game Night',
          description: 'RPG session',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
          createdBy: 'user-admin',
        }),
      )
    })

    it('returns 403 when non-admin user tries to create event', async () => {
      requireAdminMock.mockResolvedValue(
        makeAuthContext('user-member', 'member').applyCookies(
          NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 }),
        ),
      )

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(403)
      expect(createEventMock).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated user tries to create event', async () => {
      requireAdminMock.mockResolvedValue(
        NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
      )

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(401)
      expect(createEventMock).not.toHaveBeenCalled()
    })

    it('returns 400 when title is missing', async () => {
      createEventMock.mockRejectedValue(new ServiceError('Event title is required', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when date is missing', async () => {
      createEventMock.mockRejectedValue(new ServiceError('Event date is required', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when start time is missing', async () => {
      createEventMock.mockRejectedValue(new ServiceError('Event start time is required', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when end time is missing', async () => {
      createEventMock.mockRejectedValue(new ServiceError('Event end time is required', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when endTime <= startTime', async () => {
      createEventMock.mockRejectedValue(new ServiceError('endTime must be after startTime', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '23:00',
          endTime: '19:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when endTime equals startTime', async () => {
      createEventMock.mockRejectedValue(new ServiceError('endTime must be after startTime', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '19:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when date format is invalid', async () => {
      createEventMock.mockRejectedValue(new ServiceError('date must be in YYYY-MM-DD format', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: 'invalid-date',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when start time format is invalid', async () => {
      createEventMock.mockRejectedValue(new ServiceError('startTime must be in HH:MM format', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '9:00 PM',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when end time format is invalid', async () => {
      createEventMock.mockRejectedValue(new ServiceError('endTime must be in HH:MM format', 400))

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '11 PM',
        }, 'POST'),
      )

      expect(response.status).toBe(400)
    })

    it('skips auth check and returns security error when enforceMutationSecurity fails', async () => {
      enforceMutationSecurityMock.mockReturnValue(
        NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
      )

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(403)
      expect(requireAdminMock).not.toHaveBeenCalled()
      expect(createEventMock).not.toHaveBeenCalled()
    })

    it('skips auth check and returns rate limit error when rate limit is exceeded', async () => {
      enforceRateLimitMock.mockReturnValue(
        NextResponse.json({ message: 'Too Many Requests' }, { status: 429 }),
      )

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(429)
      expect(requireAdminMock).not.toHaveBeenCalled()
      expect(createEventMock).not.toHaveBeenCalled()
    })

    it('includes optional description in creation', async () => {
      const mockEvent = {
        id: 'event-new-1',
        title: 'Game Night',
        description: 'A fun RPG session',
        date: '2026-04-20',
        startTime: '19:00',
        endTime: '23:00',
        createdBy: 'user-admin',
        createdAt: '2026-04-12T10:00:00Z',
        roomBlocks: [],
      }
      createEventMock.mockResolvedValue(mockEvent)

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          description: 'A fun RPG session',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }, 'POST'),
      )

      expect(response.status).toBe(201)
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Game Night',
          description: 'A fun RPG session',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
        }),
      )
    })

    it('includes optional roomId in creation', async () => {
      const mockEvent = {
        id: 'event-new-1',
        title: 'Game Night',
        description: null,
        date: '2026-04-20',
        startTime: '19:00',
        endTime: '23:00',
        createdBy: 'user-admin',
        createdAt: '2026-04-12T10:00:00Z',
        roomBlocks: [
          {
            id: 'block-1',
            roomId: 'room-123',
            date: '2026-04-20',
            startTime: '19:00',
            endTime: '23:00',
          },
        ],
      }
      createEventMock.mockResolvedValue(mockEvent)

      const { POST } = await import('@/app/api/events/route')
      const response = await POST(
        createJsonRequest('/api/events', {
          title: 'Game Night',
          date: '2026-04-20',
          startTime: '19:00',
          endTime: '23:00',
          roomId: 'room-123',
        }, 'POST'),
      )

      expect(response.status).toBe(201)
      expect(createEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 'room-123',
        }),
      )
    })
  })

  // ===== PUT /api/events/[id] =====

  describe('PUT /api/events/[id]', () => {
    it('returns 200 with updated event when valid update is provided', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'Updated Game Night',
        date: '2026-04-20',
        startTime: '19:00',
        endTime: '23:00',
        description: 'Updated description',
        createdBy: 'user-admin',
        createdAt: '2026-04-12T10:00:00Z',
        roomBlocks: [],
      }
      updateEventMock.mockResolvedValue(mockEvent)

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', {
          title: 'Updated Game Night',
          description: 'Updated description',
        }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual(mockEvent)
      expect(updateEventMock).toHaveBeenCalledWith('event-1', expect.objectContaining({
        title: 'Updated Game Night',
        description: 'Updated description',
      }))
    })

    it('returns 404 when event is not found', async () => {
      updateEventMock.mockRejectedValue(new ServiceError('Event not found', 404))

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/nonexistent', { title: 'Updated' }, 'PUT'),
        { params: Promise.resolve({ id: 'nonexistent' }) },
      )

      expect(response.status).toBe(404)
    })

    it('returns 400 when endTime <= startTime in update', async () => {
      updateEventMock.mockRejectedValue(new ServiceError('endTime must be after startTime', 400))

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', {
          startTime: '23:00',
          endTime: '19:00',
        }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(400)
    })

    it('returns 400 when date format is invalid in update', async () => {
      updateEventMock.mockRejectedValue(new ServiceError('date must be in YYYY-MM-DD format', 400))

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', { date: 'invalid' }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(400)
    })

    it('returns 403 when non-admin user tries to update event', async () => {
      requireAdminMock.mockResolvedValue(
        makeAuthContext('user-member', 'member').applyCookies(
          NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 }),
        ),
      )

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', { title: 'Updated' }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(403)
      expect(updateEventMock).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated user tries to update event', async () => {
      requireAdminMock.mockResolvedValue(
        NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
      )

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', { title: 'Updated' }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(401)
      expect(updateEventMock).not.toHaveBeenCalled()
    })

    it('allows partial updates', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'Updated Title Only',
        date: '2026-04-20',
        startTime: '19:00',
        endTime: '23:00',
        description: 'Original description',
        createdBy: 'user-admin',
        createdAt: '2026-04-12T10:00:00Z',
        roomBlocks: [],
      }
      updateEventMock.mockResolvedValue(mockEvent)

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', { title: 'Updated Title Only' }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(200)
      expect(updateEventMock).toHaveBeenCalledWith('event-1', expect.objectContaining({
        title: 'Updated Title Only',
      }))
    })

    it('skips auth check and returns security error when enforceMutationSecurity fails', async () => {
      enforceMutationSecurityMock.mockReturnValue(
        NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
      )

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', { title: 'Updated' }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(403)
      expect(requireAdminMock).not.toHaveBeenCalled()
      expect(updateEventMock).not.toHaveBeenCalled()
    })

    it('skips auth check and returns rate limit error when rate limit is exceeded', async () => {
      enforceRateLimitMock.mockReturnValue(
        NextResponse.json({ message: 'Too Many Requests' }, { status: 429 }),
      )

      const { PUT } = await import('@/app/api/events/[id]/route')
      const response = await PUT(
        createJsonRequest('/api/events/event-1', { title: 'Updated' }, 'PUT'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(429)
      expect(requireAdminMock).not.toHaveBeenCalled()
      expect(updateEventMock).not.toHaveBeenCalled()
    })
  })

  // ===== DELETE /api/events/[id] =====

  describe('DELETE /api/events/[id]', () => {
    it('returns 204 on successful delete', async () => {
      deleteEventMock.mockResolvedValue(undefined)

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/event-1', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(204)
      expect(deleteEventMock).toHaveBeenCalledWith('event-1')
    })

    it('returns 404 when event is not found', async () => {
      deleteEventMock.mockRejectedValue(new ServiceError('Event not found', 404))

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/nonexistent', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'nonexistent' }) },
      )

      expect(response.status).toBe(404)
    })

    it('returns 409 when active reservations conflict with event', async () => {
      deleteEventMock.mockRejectedValue(
        new ServiceError('Cannot delete event: active or pending reservations exist for this room during the event time', 409),
      )

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/event-1', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(409)
    })

    it('returns 409 when pending reservations conflict with event', async () => {
      deleteEventMock.mockRejectedValue(
        new ServiceError('Cannot delete event: active or pending reservations exist for this room during the event time', 409),
      )

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/event-1', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(409)
    })

    it('returns 403 when non-admin user tries to delete event', async () => {
      requireAdminMock.mockResolvedValue(
        makeAuthContext('user-member', 'member').applyCookies(
          NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 }),
        ),
      )

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/event-1', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(403)
      expect(deleteEventMock).not.toHaveBeenCalled()
    })

    it('returns 401 when unauthenticated user tries to delete event', async () => {
      requireAdminMock.mockResolvedValue(
        NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
      )

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/event-1', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(401)
      expect(deleteEventMock).not.toHaveBeenCalled()
    })

    it('skips auth check and returns security error when enforceMutationSecurity fails', async () => {
      enforceMutationSecurityMock.mockReturnValue(
        NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
      )

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/event-1', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(403)
      expect(requireAdminMock).not.toHaveBeenCalled()
      expect(deleteEventMock).not.toHaveBeenCalled()
    })

    it('skips auth check and returns rate limit error when rate limit is exceeded', async () => {
      enforceRateLimitMock.mockReturnValue(
        NextResponse.json({ message: 'Too Many Requests' }, { status: 429 }),
      )

      const { DELETE } = await import('@/app/api/events/[id]/route')
      const response = await DELETE(
        createJsonRequest('/api/events/event-1', undefined, 'DELETE'),
        { params: Promise.resolve({ id: 'event-1' }) },
      )

      expect(response.status).toBe(429)
      expect(requireAdminMock).not.toHaveBeenCalled()
      expect(deleteEventMock).not.toHaveBeenCalled()
    })
  })
})
