// @vitest-environment node
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const markNoShowReservationsMock = vi.fn()

vi.mock('@/lib/server/reservations-service', () => ({
  markNoShowReservations: markNoShowReservationsMock,
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

describe('/api/cron/mark-no-show', () => {
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
      const { POST } = await import('@/app/api/cron/mark-no-show/route')

      const request = createRequest('/api/cron/mark-no-show', 'POST')
      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    it('returns 401 when Authorization header has wrong value', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      const { POST } = await import('@/app/api/cron/mark-no-show/route')

      const request = createRequest('/api/cron/mark-no-show', 'POST', {
        authorization: 'Bearer wrong-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
      expect(await response.json()).toEqual({ error: 'Unauthorized' })
    })

    it('returns 200 with marked count when Authorization header is correct', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      markNoShowReservationsMock.mockResolvedValueOnce(3)

      const { POST } = await import('@/app/api/cron/mark-no-show/route')

      const request = createRequest('/api/cron/mark-no-show', 'POST', {
        authorization: 'Bearer test-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ marked: 3 })
      expect(markNoShowReservationsMock).toHaveBeenCalledOnce()
    })

    it('returns 401 when CRON_SECRET is not set', async () => {
      // CRON_SECRET not stubbed - tests default behavior
      const { POST } = await import('@/app/api/cron/mark-no-show/route')

      const request = createRequest('/api/cron/mark-no-show', 'POST', {
        authorization: 'Bearer any-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('returns 500 when markNoShowReservations throws', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      markNoShowReservationsMock.mockRejectedValueOnce(new Error('Database error'))

      const { POST } = await import('@/app/api/cron/mark-no-show/route')

      const request = createRequest('/api/cron/mark-no-show', 'POST', {
        authorization: 'Bearer test-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(500)
      expect(await response.json()).toEqual({ error: 'Internal server error' })
    })

    it('returns 200 with zero count when no reservations need marking', async () => {
      vi.stubEnv('CRON_SECRET', 'test-secret')
      markNoShowReservationsMock.mockResolvedValueOnce(0)

      const { POST } = await import('@/app/api/cron/mark-no-show/route')

      const request = createRequest('/api/cron/mark-no-show', 'POST', {
        authorization: 'Bearer test-secret',
      })
      const response = await POST(request)

      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ marked: 0 })
    })
  })
})
