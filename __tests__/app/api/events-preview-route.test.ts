// @vitest-environment node
/**
 * KIM-383: Route-level tests for POST /api/events/preview
 *
 * Mirrors the harness used in __tests__/app/api/events.test.ts.
 * Covers the full security chain: enforceMutationSecurity → enforceRateLimit → requireAdmin.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

// --- Top-level mock functions ---

const requireAdminMock = vi.fn()
const previewEventConflictsMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/server/events-service', () => ({
  previewEventConflicts: previewEventConflictsMock,
}))

vi.mock('@/lib/server/security', () => ({
  enforceMutationSecurity: enforceMutationSecurityMock,
  enforceRateLimit: enforceRateLimitMock,
  RATE_LIMIT_POLICIES: {
    adminMutation: { bucket: 'admin-mutation', limit: 20, windowMs: 60_000 },
  },
}))

// --- Helpers ---

function makeAuthContext(userId = 'user-abc', _role: 'member' | 'admin' = 'admin') {
  return {
    session: { id: userId, role: _role },
    applyCookies: (res: NextResponse) => res,
  }
}

function createJsonRequest(body?: unknown) {
  return new NextRequest('http://localhost:3000/api/events/preview', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const validPreviewBody = {
  schedules: [
    { date: '2026-09-01', startTime: '10:00', endTime: '14:00', roomId: 'room-1', allDay: false },
  ],
}

const validPreviewResult = {
  total: 3,
  blocks: [{ date: '2026-09-01', roomId: 'room-1', count: 3 }],
}

// --- Tests ---

describe('POST /api/events/preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Security passes by default
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    // Auth passes by default as admin
    requireAdminMock.mockResolvedValue(makeAuthContext('user-admin', 'admin'))
  })

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('returns 200 with conflict preview when valid admin request is made', async () => {
    previewEventConflictsMock.mockResolvedValue(validPreviewResult)

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest(validPreviewBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(validPreviewResult)
    expect(previewEventConflictsMock).toHaveBeenCalledWith(validPreviewBody)
  })

  it('returns 200 with total: 0 and empty blocks when no conflicts exist', async () => {
    previewEventConflictsMock.mockResolvedValue({ total: 0, blocks: [] })

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest(validPreviewBody))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ total: 0, blocks: [] })
  })

  // -------------------------------------------------------------------------
  // Auth: unauthenticated → 401
  // -------------------------------------------------------------------------

  it('returns 401 when the request is unauthenticated', async () => {
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
    )

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest(validPreviewBody))

    expect(response.status).toBe(401)
    expect(previewEventConflictsMock).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Auth: non-admin → 403
  // -------------------------------------------------------------------------

  it('returns 403 when the user is authenticated but not an admin', async () => {
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 }),
    )

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest(validPreviewBody))

    expect(response.status).toBe(403)
    expect(previewEventConflictsMock).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Security: missing CSRF / mutation-security → 403
  // -------------------------------------------------------------------------

  it('returns 403 and skips auth when enforceMutationSecurity fails', async () => {
    enforceMutationSecurityMock.mockReturnValue(
      NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    )

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest(validPreviewBody))

    expect(response.status).toBe(403)
    expect(requireAdminMock).not.toHaveBeenCalled()
    expect(previewEventConflictsMock).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Rate limit → 429
  // -------------------------------------------------------------------------

  it('returns 429 and skips auth when rate limit is exceeded', async () => {
    enforceRateLimitMock.mockReturnValue(
      NextResponse.json({ message: 'Too Many Requests' }, { status: 429 }),
    )

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest(validPreviewBody))

    expect(response.status).toBe(429)
    expect(requireAdminMock).not.toHaveBeenCalled()
    expect(previewEventConflictsMock).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Service errors propagate
  // -------------------------------------------------------------------------

  it('returns 400 when the service throws a validation error (e.g. > 366 schedules)', async () => {
    const { ServiceError } = await import('@/lib/server/service-error')
    previewEventConflictsMock.mockRejectedValue(new ServiceError('Too many schedule blocks', 400))

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest({ schedules: [] }))

    expect(response.status).toBe(400)
    expect(previewEventConflictsMock).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when the service throws an internal server error', async () => {
    const { ServiceError } = await import('@/lib/server/service-error')
    previewEventConflictsMock.mockRejectedValue(new ServiceError('Internal server error', 500))

    const { POST } = await import('@/app/api/events/preview/route')
    const response = await POST(createJsonRequest(validPreviewBody))

    expect(response.status).toBe(500)
  })
})
