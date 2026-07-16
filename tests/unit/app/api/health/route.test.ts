// @vitest-environment node
/**
 * KIM-409: Route-level tests for GET /api/health
 *
 * Validates that the health check endpoint:
 * - Returns 200 OK with { status: 'ok' }
 * - Works without authentication
 * - Returns a fresh response on repeated calls (dynamic = 'force-dynamic')
 */

import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

describe('GET /api/health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const request = new NextRequest('http://localhost:3000/api/health', {
      method: 'GET',
      headers: {
        host: 'localhost:3000',
      },
    })

    const { GET } = await import('@/app/api/health/route')
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: 'ok' })
  })

  it('works without authentication', async () => {
    const { GET } = await import('@/app/api/health/route')
    const response = await GET()

    // No auth check should occur; endpoint should succeed
    expect(response.status).toBe(200)
    expect(response.ok).toBe(true)
  })

  it('returns a fresh response on repeated calls (dynamic endpoint)', async () => {
    const { GET } = await import('@/app/api/health/route')

    const response1 = await GET()
    const response2 = await GET()

    // Both should succeed and return the same payload
    expect(response1.status).toBe(200)
    expect(response2.status).toBe(200)

    const body1 = await response1.json()
    const body2 = await response2.json()

    expect(body1).toEqual({ status: 'ok' })
    expect(body2).toEqual({ status: 'ok' })
  })
})
