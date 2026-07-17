// @vitest-environment node
import { beforeEach, describe, expect, it, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

function createRequest(path: string, method: 'GET' | 'POST' = 'GET') {
  return new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: {
      host: 'localhost:3000',
    },
  })
}

describe('/api/cron/cancel-pending', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('POST method', () => {
    it('returns 410 Gone with deprecation message', async () => {
      const { POST } = await import('@/app/api/cron/cancel-pending/route')

      const request = createRequest('/api/cron/cancel-pending', 'POST')
      const response = await POST(request)

      expect(response.status).toBe(410)
      const body = await response.json()
      expect(body).toMatchObject({
        error: 'Endpoint deprecated',
        message: expect.stringContaining('lazy evaluation'),
      })
    })

    it('returns 410 regardless of Authorization header', async () => {
      const { POST } = await import('@/app/api/cron/cancel-pending/route')

      const request = new NextRequest('http://localhost:3000/api/cron/cancel-pending', {
        method: 'POST',
        headers: { authorization: 'Bearer any-secret' },
      })
      const response = await POST(request)

      expect(response.status).toBe(410)
    })
  })
})
