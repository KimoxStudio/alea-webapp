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

type ParsedIpAddress = {
  bits: 32 | 128
  value: bigint
}

type ParsedCidr = ParsedIpAddress & {
  mask: bigint
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const ALLOWED_FETCH_SITES = new Set(['same-origin', 'same-site', 'none'])
const RATE_LIMIT_STORE_KEY = '__aleaRateLimitStore'
const TRUSTED_PROXY_CIDRS_ENV = 'TRUSTED_PROXY_CIDRS'
const DEFAULT_TRUSTED_PROXY_CIDRS = ['127.0.0.1/32', '::1/128'] as const

const globalRateLimitStore = globalThis as typeof globalThis & {
  [RATE_LIMIT_STORE_KEY]?: Map<string, RateLimitEntry>
}

function getRateLimitStore() {
  if (!globalRateLimitStore[RATE_LIMIT_STORE_KEY]) {
    globalRateLimitStore[RATE_LIMIT_STORE_KEY] = new Map<string, RateLimitEntry>()
  }

  return globalRateLimitStore[RATE_LIMIT_STORE_KEY]
}

// Determines whether cookies should have the Secure flag.
// Based on NEXT_PUBLIC_APP_URL — not NODE_ENV — because the environment
// is defined by which Supabase keys are configured, not Node's runtime mode.
// Warn at most once per process — this is called on every request.
let _warnedAboutMissingAppUrl = false

function isSecureContext(): boolean {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl && !_warnedAboutMissingAppUrl) {
    _warnedAboutMissingAppUrl = true
    console.warn(
      '[security] NEXT_PUBLIC_APP_URL is not set — cookies will be issued without the Secure flag.' +
        ' Set it to your app URL (e.g. https://app.alea.club).',
    )
  }
  return (appUrl ?? '').startsWith('https://')
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

function normalizeIp(value: string | null) {
  if (!value) return null

  const [first] = value.split(',')
  const candidate = first?.trim().replace(/^"|"$/g, '')
  if (!candidate) return null

  const bracketedIpv6 = /^\[([^\]]+)\](?::\d+)?$/.exec(candidate)
  if (bracketedIpv6) {
    return bracketedIpv6[1]
  }

  const lastColon = candidate.lastIndexOf(':')
  const lastDot = candidate.lastIndexOf('.')
  if (lastDot > -1 && lastColon > lastDot) {
    return candidate.slice(0, lastColon)
  }

  return candidate
}

function parseIpv4(ip: string): ParsedIpAddress | null {
  const octets = ip.split('.')
  if (octets.length !== 4) return null

  let value = BigInt(0)
  for (const octet of octets) {
    if (!/^\d+$/.test(octet)) return null

    const numericOctet = Number(octet)
    if (numericOctet < 0 || numericOctet > 255) return null

    value = (value << BigInt(8)) | BigInt(numericOctet)
  }

  return { bits: 32, value }
}

function parseIpv6Segment(segment: string) {
  if (!/^[\da-f]{1,4}$/i.test(segment)) return null
  return Number.parseInt(segment, 16)
}

function expandIpv6Segments(ip: string) {
  if (ip.includes(':::')) return null

  const hasCompression = ip.includes('::')
  const [head, tail] = ip.split('::')
  if (hasCompression && tail === undefined) return null

  const parsePart = (part: string) =>
    part
      .split(':')
      .filter(Boolean)
      .flatMap((segment) => {
        if (!segment.includes('.')) {
          const parsedSegment = parseIpv6Segment(segment)
          return parsedSegment === null ? [null] : [parsedSegment]
        }

        const parsedIpv4 = parseIpv4(segment)
        if (!parsedIpv4) return [null]

        return [
          Number((parsedIpv4.value >> BigInt(16)) & BigInt(0xffff)),
          Number(parsedIpv4.value & BigInt(0xffff)),
        ]
      })

  const headSegments = parsePart(head ?? '')
  const tailSegments = parsePart(tail ?? '')
  if (headSegments.some((segment) => segment === null)) return null
  if (tailSegments.some((segment) => segment === null)) return null

  const totalSegments = headSegments.length + tailSegments.length
  if ((!hasCompression && totalSegments !== 8) || totalSegments > 8) {
    return null
  }

  const zerosToInsert = hasCompression ? 8 - totalSegments : 0
  return [
    ...(headSegments as number[]),
    ...new Array(zerosToInsert).fill(0),
    ...(tailSegments as number[]),
  ]
}

function parseIpv6(ip: string): ParsedIpAddress | null {
  const segments = expandIpv6Segments(ip)
  if (!segments) return null

  let value = BigInt(0)
  for (const segment of segments) {
    value = (value << BigInt(16)) | BigInt(segment)
  }

  return { bits: 128, value }
}

function parseIpAddress(ip: string) {
  return parseIpv4(ip) ?? parseIpv6(ip)
}

function getValidIp(value: string | null) {
  const candidate = normalizeIp(value)
  return candidate && parseIpAddress(candidate) ? candidate : null
}

function createMask(bits: 32 | 128, prefixLength: number) {
  if (prefixLength === 0) return BigInt(0)

  const hostBits = BigInt(bits - prefixLength)
  const fullMask = (BigInt(1) << BigInt(bits)) - BigInt(1)
  return (fullMask << hostBits) & fullMask
}

function parseCidr(cidr: string) {
  const trimmed = cidr.trim()
  if (!trimmed) return null

  const parts = trimmed.split('/')
  if (parts.length !== 2) return null

  const [rawIp, rawPrefix] = parts
  const ip = getValidIp(rawIp)
  if (!ip) return null

  const parsedIp = parseIpAddress(ip)
  if (!parsedIp) return null

  const prefixLength = Number.parseInt(rawPrefix, 10)
  if (!Number.isInteger(prefixLength) || prefixLength < 0 || prefixLength > parsedIp.bits) {
    return null
  }

  const mask = createMask(parsedIp.bits, prefixLength)

  return {
    ...parsedIp,
    value: parsedIp.value & mask,
    mask,
  } satisfies ParsedCidr
}

function isIpInCidr(ip: string, cidr: string) {
  const parsedIp = getValidIp(ip)
  const parsedCidr = parseCidr(cidr)
  if (!parsedIp || !parsedCidr) {
    return false
  }

  const parsedIpAddress = parseIpAddress(parsedIp)
  if (!parsedIpAddress || parsedIpAddress.bits !== parsedCidr.bits) return false

  return (parsedIpAddress.value & parsedCidr.mask) === parsedCidr.value
}

function getTrustedProxyCidrs() {
  const configuredCidrs = process.env[TRUSTED_PROXY_CIDRS_ENV]
  const cidrs = configuredCidrs
    ? configuredCidrs.split(/[,\s]+/)
    : [...DEFAULT_TRUSTED_PROXY_CIDRS]

  return cidrs
    .map((cidr) => cidr.trim())
    .filter(Boolean)
}

function isTrustedProxySourceIp(ip: string | null) {
  if (!ip) return false
  return getTrustedProxyCidrs().some((cidr) => isIpInCidr(ip, cidr))
}

function getClientAddress(request: NextRequest) {
  const realIp = getValidIp(request.headers.get('x-real-ip'))
  const forwardedFor = getValidIp(request.headers.get('x-forwarded-for'))

  if (forwardedFor && isTrustedProxySourceIp(realIp)) {
    return forwardedFor
  }

  return realIp || 'local'
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
    secure: isSecureContext(),
  } satisfies CookieOptionsWithName
}

export function getSupabaseCookieOptions() {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isSecureContext(),
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
