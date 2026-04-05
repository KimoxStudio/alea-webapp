import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

describe('server security helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('uses secure:false for Supabase cookies when NEXT_PUBLIC_APP_URL is http (localhost)', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
    const security = await import('@/lib/server/security')

    expect(security.getSupabaseCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    })
  })

  it('uses secure:true for Supabase cookies when NEXT_PUBLIC_APP_URL is https', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.alea.club')
    const security = await import('@/lib/server/security')

    expect(security.getSupabaseCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    })
  })

  it('returns 429 when a client exceeds the configured rate limit window', async () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '127.0.0.1/32')
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-rate-limit', limit: 2, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.77',
          'x-real-ip': '127.0.0.1',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.77',
          'x-real-ip': '127.0.0.1',
        },
      }),
      policy,
    )
    const third = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.77',
          'x-real-ip': '127.0.0.1',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second).toBeNull()
    expect(third?.status).toBe(429)
    expect(third?.headers.get('retry-after')).toBeTruthy()
  })

  it('trusts x-forwarded-for only when the request comes through a trusted proxy IP', async () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '127.0.0.1/32')
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-trusted-forwarded-for', limit: 1, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.10',
          'x-real-ip': '127.0.0.1',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.11',
          'x-real-ip': '127.0.0.1',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second).toBeNull()
  })

  it('ignores spoofed x-forwarded-for headers from untrusted clients', async () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '127.0.0.1/32')
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-untrusted-forwarded-for', limit: 1, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.10',
          'x-real-ip': '198.51.100.25',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.11',
          'x-real-ip': '198.51.100.25',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second?.status).toBe(429)
  })

  it('falls back to local when forwarded headers are present without a trusted source IP', async () => {
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-missing-real-ip', limit: 1, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.40',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.41',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second?.status).toBe(429)
  })

  it('does not trust platform-style headers on their own', async () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '127.0.0.1/32')
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-forged-platform-header', limit: 1, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.20',
          'x-real-ip': '198.51.100.30',
          'x-vercel-id': 'cdg1::iad1::test',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.21',
          'x-real-ip': '198.51.100.30',
          'x-vercel-id': 'cdg1::iad1::test',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second?.status).toBe(429)
  })

  it('rejects malformed IPv6 proxy source values when deciding whether to trust x-forwarded-for', async () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '::1/128')
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-invalid-ipv6-source', limit: 1, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.60',
          'x-real-ip': '2001::db8::1',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.61',
          'x-real-ip': '2001::db8::1',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second?.status).toBe(429)
  })

  it('rejects malformed non-compressed IPv6 values with empty segments', async () => {
    vi.stubEnv('TRUST_PROXY_HEADERS', 'true')
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '::1/128')
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-invalid-ipv6-empty-segment', limit: 1, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.70',
          'x-real-ip': ':1:2:3:4:5:6:7:8',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.71',
          'x-real-ip': ':1:2:3:4:5:6:7:8',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second?.status).toBe(429)
  })

  it('does not trust x-forwarded-for unless proxy header trust is explicitly enabled', async () => {
    vi.stubEnv('TRUSTED_PROXY_CIDRS', '127.0.0.1/32')
    const { enforceRateLimit } = await import('@/lib/server/security')
    const policy = { bucket: 'test-proxy-trust-disabled', limit: 1, windowMs: 60_000 }

    const first = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.80',
          'x-real-ip': '127.0.0.1',
        },
      }),
      policy,
    )
    const second = enforceRateLimit(
      new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'x-forwarded-for': '203.0.113.81',
          'x-real-ip': '127.0.0.1',
        },
      }),
      policy,
    )

    expect(first).toBeNull()
    expect(second?.status).toBe(429)
  })
})
