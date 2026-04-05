import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import type { CookieOptions } from '@supabase/ssr'

const createI18nResponse = vi.fn((request: NextRequest) =>
  NextResponse.redirect(new URL('/es', request.url)),
)
const getUserMock = vi.fn()
const createServerClientMock = vi.fn()

vi.mock('next-intl/middleware', () => ({
  default: vi.fn(() => (request: NextRequest) => createI18nResponse(request)),
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: createServerClientMock.mockImplementation((_url: string, _key: string, options: {
    cookieOptions?: CookieOptions & { name?: string }
    cookies: {
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => void
    }
  }) => ({
    auth: {
      getUser: vi.fn(async () => {
        options.cookies.setAll([
          {
            name: 'sb-access-token',
            value: 'refreshed-token',
            options: { path: '/', httpOnly: true, sameSite: 'lax' },
          },
        ])

        return getUserMock()
      }),
    },
  })),
}))

describe('middleware', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key')
    getUserMock.mockResolvedValue({ data: { user: null }, error: null })
  })

  it('preserves the locale middleware response while applying refreshed Supabase cookies', async () => {
    const middleware = (await import('@/middleware')).default

    const response = await middleware(new NextRequest('http://localhost:3000/rooms'))

    expect(response.headers.get('location')).toBe('http://localhost:3000/es')
    expect(response.cookies.get('sb-access-token')?.value).toBe('refreshed-token')
    const csrfCookie = response.cookies.get('alea-csrf-token')
    expect(csrfCookie?.value).toBeTruthy()
    expect(csrfCookie?.httpOnly).toBe(false)
    expect(csrfCookie?.sameSite).toBe('lax')
    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        cookieOptions: expect.objectContaining({
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: false,
        }),
      }),
    )
  })

  it('does not rewrite the CSRF cookie when a valid token already exists', async () => {
    const middleware = (await import('@/middleware')).default

    const response = await middleware(new NextRequest('http://localhost:3000/rooms', {
      headers: {
        cookie: 'alea-csrf-token=1234567890abcdef1234567890abcdef',
      },
    }))

    expect(response.cookies.get('alea-csrf-token')).toBeUndefined()
  })

  it('switches the Supabase auth cookie policy to secure cookies in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const middleware = (await import('@/middleware')).default

    await middleware(new NextRequest('https://alea.club/rooms'))

    expect(createServerClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        cookieOptions: expect.objectContaining({
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: true,
        }),
      }),
    )
  })
})
