import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Role, User } from '@alea/types'

const SESSION_COOKIE_NAME = 'auth_session'
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

type SessionPayload = {
  userId: string
  role: Role
  exp: number
}

export type SessionUser = Pick<User, 'id' | 'role'>

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET
  if (!secret) {
    throw new Error(
      'AUTH_SESSION_SECRET environment variable is not set. Set it to a random string of at least 32 characters.',
    )
  }
  return secret
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, 'base64url').toString('utf-8')
}

function sign(input: string) {
  return createHmac('sha256', getSessionSecret()).update(input).digest('base64url')
}

function secureCompare(a: string, b: string) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function isProduction() {
  return process.env.NODE_ENV === 'production'
}

export function createSessionToken(user: Pick<User, 'id' | 'role'>) {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ONE_WEEK_SECONDS,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

function parseSessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) return null
  const expectedSignature = sign(encodedPayload)
  if (!secureCompare(expectedSignature, signature)) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload
    if (!payload.userId || !payload.role || !payload.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function setSessionCookie(response: NextResponse, user: Pick<User, 'id' | 'role'>) {
  response.cookies.set(SESSION_COOKIE_NAME, createSessionToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: ONE_WEEK_SECONDS,
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction(),
    path: '/',
    maxAge: 0,
  })
}

export function getSessionFromRequest(request: NextRequest): SessionUser | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const payload = parseSessionToken(token)
  if (!payload) return null
  return { id: payload.userId, role: payload.role }
}

export async function getSessionFromServerCookies(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const payload = parseSessionToken(token)
  if (!payload) return null
  return { id: payload.userId, role: payload.role }
}

export function requireAuth(request: NextRequest): SessionUser | NextResponse {
  const session = getSessionFromRequest(request)
  if (!session) return NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 })
  return session
}

export function requireAdmin(request: NextRequest): SessionUser | NextResponse {
  const session = requireAuth(request)
  if (session instanceof NextResponse) return session
  if (session.role !== 'admin') return NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 })
  return session
}

export function enforceSameOriginForMutation(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return null

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host) {
    return NextResponse.json({ message: 'Invalid request origin', statusCode: 403 }, { status: 403 })
  }

  try {
    const originHost = new URL(origin).host
    if (originHost !== host) {
      return NextResponse.json({ message: 'Invalid request origin', statusCode: 403 }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ message: 'Invalid request origin', statusCode: 403 }, { status: 403 })
  }

  return null
}
