import { NextRequest, NextResponse } from 'next/server'
import type { CookieOptionsWithName } from '@supabase/ssr'

export const CSRF_COOKIE_NAME = 'alea-csrf-token'
export const CSRF_HEADER_NAME = 'x-csrf-token'

type RateLimitPolicy = {
  bucket: string
  limit: number
  windowMs: number
}

type RateLimitEntry = {
  count: number
  resetAt: number
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const ALLOWED_FETCH_SITES = new Set(['same-origin', 'same-site', 'none'])
const RATE_LIMIT_STORE_KEY = '__aleaRateLimitStore'

const globalRateLimitStore = globalThis as typeof globalThis & {
  [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitEntry>
}

function getRateLimitStore() {
  if (!globalRateLimitStore[RATE_LIMIT_STORE_KEY]) {
    globalRateLimitStore[RATE_LIMIT_STORE_KEY] = new Map<string, RateLimitEntry>()
  }

  return globalRateLimitStore[RATE_LIMIT_STORE_KEY]
}

function forbidden(message: string) {
  return NextResponse.json({ message, statusCode: 403 }, { status: 403 })
}

function tooManyRequests(retryAfterSeconds: number) {
  const response = NextResponse.json(
    { message: 'Too many requests', statusCode: 429 },
    { status: 429 },
  )
  response.headers.set('Retry-After', String(retryAfterSeconds))
  return response
}

function isUnsafeMethod(method: string) {
  return !SAFE_METHODS.has(method.toUpperCase())
}

function getClientAddress(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const [first] = forwardedFor.split(',')
    if (first) return first.trim()
  }

  return request.headers.get('x-real-ip')?.trim() || 'local'
}

function tokensMatch(left: string, right: string) {
  if (left.length !== right.length) return false

  let mismatch = 0
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }

  return mismatch === 0
}

export function createCsrfToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    path: '/',
    sameSite: 'lax',
    secure: true, // environment is determined by Supabase keys, not NODE_ENV
  } satisfies CookieOptionsWithName
}

export function getSupabaseCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: true, // environment is determined by Supabase keys, not NODE_ENV
  } satisfies CookieOptionsWithName
}

export function ensureCsrfCookie(request: NextRequest, response: NextResponse) {
  const currentToken = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const shouldSetCookie = !currentToken || currentToken.length < 32
  const token = shouldSetCookie ? createCsrfToken() : currentToken

  if (shouldSetCookie) {
    request.cookies.set(CSRF_COOKIE_NAME, token)
    response.cookies.set(CSRF_COOKIE_NAME, token, getCsrfCookieOptions())
  }

  return response
}

export function enforceMutationSecurity(request: NextRequest): NextResponse | null {
  if (!isUnsafeMethod(request.method)) return null

  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite && !ALLOWED_FETCH_SITES.has(fetchSite)) {
    return forbidden('Cross-site requests are not allowed')
  }

  const origin = request.headers.get('origin')
  if (!origin) {
    return forbidden('Invalid request origin')
  }

  try {
    const requestOrigin = new URL(request.url).origin
    if (new URL(origin).origin !== requestOrigin) {
      return forbidden('Invalid request origin')
    }
  } catch {
    return forbidden('Invalid request origin')
  }

  const csrfCookie = request.cookies.get(CSRF_COOKIE_NAME)?.value
  const csrfHeader = request.headers.get(CSRF_HEADER_NAME)

  if (!csrfCookie || !csrfHeader) {
    return forbidden('Invalid CSRF token')
  }

  if (!tokensMatch(csrfCookie, csrfHeader)) {
    return forbidden('Invalid CSRF token')
  }

  return null
}

/**
 * @deprecated Use `enforceMutationSecurity` instead. This helper now enforces
 * Fetch Metadata, same-origin `Origin` validation, and double-submit CSRF
 * protection, so the old name is preserved only for backwards compatibility.
 */
export function enforceSameOriginForMutation(request: NextRequest): NextResponse | null {
  return enforceMutationSecurity(request)
}

export function enforceRateLimit(
  request: NextRequest,
  policy: RateLimitPolicy,
): NextResponse | null {
  const store = getRateLimitStore()
  const now = Date.now()

  if (store.size > 5000) {
    for (const [key, value] of store.entries()) {
      if (value.resetAt <= now) {
        store.delete(key)
      }
    }
  }

  const key = `${policy.bucket}:${getClientAddress(request)}`
  const current = store.get(key)

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + policy.windowMs,
    })
    return null
  }

  current.count += 1
  if (current.count > policy.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return tooManyRequests(retryAfterSeconds)
  }

  return null
}

export const RATE_LIMIT_POLICIES = {
  authLogin: { bucket: 'auth-login', limit: 5, windowMs: 60_000 },
  authRegister: { bucket: 'auth-register', limit: 3, windowMs: 60_000 },
  authLogout: { bucket: 'auth-logout', limit: 10, windowMs: 60_000 },
  adminMutation: { bucket: 'admin-mutation', limit: 30, windowMs: 60_000 },
  reservationMutation: { bucket: 'reservation-mutation', limit: 20, windowMs: 60_000 },
} satisfies Record<string, RateLimitPolicy>
