import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { ServiceError } from '@/lib/server/service-error'

// --- Top-level mock functions ---

const requireAuthMock = vi.fn()
const activateReservationByTableMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAuth: requireAuthMock,
}))

vi.mock('@/lib/server/reservations-service', () => ({
  activateReservationByTable: activateReservationByTableMock,
}))

vi.mock('@/lib/server/security', () => ({
  enforceMutationSecurity: enforceMutationSecurityMock,
  enforceRateLimit: enforceRateLimitMock,
  RATE_LIMIT_POLICIES: {
    reservationMutation: { bucket: 'reservation-mutation', limit: 20, windowMs: 60_000 },
  },
}))

// --- Helpers ---

function makeAuthContext(userId = 'user-abc', role: 'member' | 'admin' = 'member') {
  return {
    session: { id: userId, role },
    applyCookies: (res: NextResponse) => res,
  }
}

function createRequest(tableId: string, options?: { side?: string }) {
  const url = new URL(`http://localhost:3000/api/tables/${tableId}/activate`)
  if (options?.side) url.searchParams.set('side', options.side)
  return new NextRequest(url.toString(), {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
}

// --- Tests ---

describe('POST /api/tables/[id]/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Security passes by default
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    // Auth passes by default
    requireAuthMock.mockResolvedValue(makeAuthContext())
  })

  it('returns 200 with reservation on successful activation', async () => {
    const mockReservation = { id: 'res-1', status: 'active', table_id: 'table-123' }
    activateReservationByTableMock.mockResolvedValue(mockReservation)

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ reservation: mockReservation })
    expect(activateReservationByTableMock).toHaveBeenCalledWith('table-123', 'user-abc', undefined)
  })

  it('passes side=inf to service when query param is present', async () => {
    activateReservationByTableMock.mockResolvedValue({ id: 'res-2', status: 'active' })

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    await POST(createRequest('table-123', { side: 'inf' }), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(activateReservationByTableMock).toHaveBeenCalledWith('table-123', 'user-abc', 'inf')
  })

  it('passes side=undefined for any non-inf side query param value', async () => {
    activateReservationByTableMock.mockResolvedValue({ id: 'res-3', status: 'active' })

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    await POST(createRequest('table-123', { side: 'top' }), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(activateReservationByTableMock).toHaveBeenCalledWith('table-123', 'user-abc', undefined)
  })

  it('returns security error and skips auth when enforceMutationSecurity fails', async () => {
    enforceMutationSecurityMock.mockReturnValue(
      NextResponse.json({ message: 'Forbidden' }, { status: 403 }),
    )

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(403)
    expect(requireAuthMock).not.toHaveBeenCalled()
    expect(activateReservationByTableMock).not.toHaveBeenCalled()
  })

  it('returns rate limit error and skips auth when rate limit is exceeded', async () => {
    enforceRateLimitMock.mockReturnValue(
      NextResponse.json({ message: 'Too Many Requests' }, { status: 429 }),
    )

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(429)
    expect(requireAuthMock).not.toHaveBeenCalled()
    expect(activateReservationByTableMock).not.toHaveBeenCalled()
  })

  it('returns 401 when session is missing or invalid', async () => {
    requireAuthMock.mockResolvedValue(
      NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 }),
    )

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(401)
    expect(activateReservationByTableMock).not.toHaveBeenCalled()
  })

  it('returns 404 when table is not found', async () => {
    activateReservationByTableMock.mockRejectedValue(new ServiceError('Table not found', 404))

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toMatchObject({ message: 'Table not found', statusCode: 404 })
  })

  it('returns 409 when reservation is already activated (TOCTOU race)', async () => {
    activateReservationByTableMock.mockRejectedValue(
      new ServiceError('CHECK_IN_ALREADY_ACTIVE', 409),
    )

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body).toMatchObject({ message: 'CHECK_IN_ALREADY_ACTIVE', statusCode: 409 })
  })

  it('returns 409 for PGRST116 concurrent activation (already mapped to 409 by service)', async () => {
    // PGRST116 is caught inside activateReservationByTable and re-thrown as ServiceError 409
    activateReservationByTableMock.mockRejectedValue(
      new ServiceError('CHECK_IN_ALREADY_ACTIVE', 409),
    )

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(409)
  })

  it('returns 404 when no pending reservation exists for the table', async () => {
    activateReservationByTableMock.mockRejectedValue(
      new ServiceError('CHECK_IN_NO_RESERVATION', 404),
    )

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(404)
    const body = await response.json()
    expect(body).toMatchObject({ message: 'CHECK_IN_NO_RESERVATION', statusCode: 404 })
  })

  it('returns 400 when check-in window has not started yet', async () => {
    activateReservationByTableMock.mockRejectedValue(new ServiceError('CHECK_IN_TOO_EARLY', 400))

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ message: 'CHECK_IN_TOO_EARLY', statusCode: 400 })
  })

  it('returns 400 when check-in window has expired', async () => {
    activateReservationByTableMock.mockRejectedValue(new ServiceError('CHECK_IN_TOO_LATE', 400))

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toMatchObject({ message: 'CHECK_IN_TOO_LATE', statusCode: 400 })
  })

  it('returns 500 for unexpected non-ServiceError exceptions', async () => {
    activateReservationByTableMock.mockRejectedValue(new Error('Unexpected database failure'))

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toMatchObject({ message: 'Internal server error', statusCode: 500 })
  })

  it('applies auth cookies to successful response', async () => {
    const applyCookiesMock = vi.fn((res: NextResponse) => {
      res.cookies.set('sb-access-token', 'refreshed-token')
      return res
    })
    requireAuthMock.mockResolvedValue({
      session: { id: 'user-abc', role: 'member' },
      applyCookies: applyCookiesMock,
    })
    activateReservationByTableMock.mockResolvedValue({ id: 'res-1', status: 'active' })

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(applyCookiesMock).toHaveBeenCalledOnce()
    expect(response.cookies.get('sb-access-token')?.value).toBe('refreshed-token')
  })

  it('applies auth cookies even when service throws', async () => {
    const applyCookiesMock = vi.fn((res: NextResponse) => {
      res.cookies.set('sb-access-token', 'refreshed-token')
      return res
    })
    requireAuthMock.mockResolvedValue({
      session: { id: 'user-abc', role: 'member' },
      applyCookies: applyCookiesMock,
    })
    activateReservationByTableMock.mockRejectedValue(new ServiceError('Table not found', 404))

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    const response = await POST(createRequest('table-123'), {
      params: Promise.resolve({ id: 'table-123' }),
    })

    expect(response.status).toBe(404)
    expect(applyCookiesMock).toHaveBeenCalledOnce()
  })

  it('uses authenticated user id when calling activateReservationByTable', async () => {
    requireAuthMock.mockResolvedValue(makeAuthContext('specific-user-id', 'admin'))
    activateReservationByTableMock.mockResolvedValue({ id: 'res-1', status: 'active' })

    const { POST } = await import('@/app/api/tables/[id]/activate/route')
    await POST(createRequest('table-xyz'), {
      params: Promise.resolve({ id: 'table-xyz' }),
    })

    expect(activateReservationByTableMock).toHaveBeenCalledWith(
      'table-xyz',
      'specific-user-id',
      undefined,
    )
  })
})
