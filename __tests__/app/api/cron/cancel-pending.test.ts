// @vitest-environment node
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const cancelExpiredPendingReservationsMock = vi.fn()

vi.mock('@/lib/server/reservations-service', () => ({
  cancelExpiredPendingReservations: cancelExpiredPendingReservationsMock,
}))

function createRequest(path: string, method: 'GET' | 'POST' = 'GET', options?: { authorization?: string }) {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      host: 'localhost:3000',
      ...(options?.authorization ? { authorization: options.authorization } : {}),
    },
  })
}

describe('/api/cron/cancel-pending', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('POST method', () => {
    it('returns 401 when Authorization header is missing', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      const { POST } = await import('@/app/api/cron/cancel-pending/route')

      const request = createRequest('/api/cron/cancel-pending', 'POST')
      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    it('returns 401 when Authorization header has wrong value', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      const { POST } = await import('@/app/api/cron/cancel-pending/route')

      const request = createRequest('/api/cron/cancel-pending', 'POST', {
        authorization: 'Bearer wrong-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    it('returns 200 with cancelled count when Authorization header is correct', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      cancelExpiredPendingReservationsMock.mockResolvedValueOnce(5)

      const { POST } = await import('@/app/api/cron/cancel-pending/route')

      const request = createRequest('/api/cron/cancel-pending', 'POST', {
        authorization: 'Bearer test-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ cancelled: 5 })
      expect(cancelExpiredPendingReservationsMock).toHaveBeenCalledOnce()
    })

    it('returns 401 when CRON_SECRET is not set', async () => {
      // CRON_SECRET not stubbed - tests default behavior
      const { POST } = await import('@/app/api/cron/cancel-pending/route')

      const request = createRequest('/api/cron/cancel-pending', 'POST', {
        authorization: 'Bearer any-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('returns 500 when cancelExpiredPendingReservations throws', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      cancelExpiredPendingReservationsMock.mockRejectedValueOnce(new Error('Database error'))

      const { POST } = await import('@/app/api/cron/cancel-pending/route')

      const request = createRequest('/api/cron/cancel-pending', 'POST', {
        authorization: 'Bearer test-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
    })
  })
})
