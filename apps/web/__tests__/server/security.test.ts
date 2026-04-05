import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

describe('server security helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('uses hardened cookie options for Supabase sessions in development and production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    let security = await import('@/lib/server/security')

    expect(security.getSupabaseCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    })

    vi.resetModules()
    vi.stubEnv('NODE_ENV', 'production')
    security = await import('@/lib/server/security')

    expect(security.getSupabaseCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    })
  })

  it('returns 429 when a client exceeds the configured rate limit window', async () => {
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-rate-limit', limit: 2, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.77' },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.77' },
      }),
      policy,
    )
    const third = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.77' },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second).toBeNull()
    expect(third?.status).toBe(429)
    expect(third?.headers.get('retry-after')).toBeTruthy()
  })
})
