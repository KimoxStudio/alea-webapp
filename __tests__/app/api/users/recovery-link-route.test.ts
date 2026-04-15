import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const requireAdminMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()
const generateRecoveryLinkMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/server/auth-service', () => ({
  generateRecoveryLink: generateRecoveryLinkMock,
}))

vi.mock('@/lib/server/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/server/security')>()
  return {
    ...actual,
    enforceMutationSecurity: enforceMutationSecurityMock,
    enforceRateLimit: enforceRateLimitMock,
    RATE_LIMIT_POLICIES: {
      adminMutation: { bucket: 'admin-mutation', limit: 50, windowMs: 60_000 },
    },
  }
})

function makeAdminContext(userId = 'admin-1', role: 'member' | 'admin' = 'admin') {
  return {
    session: { id: userId, role },
    applyCookies: (res: NextResponse) => res,
  }
}

function createRequest(locale = 'es') {
  return new NextRequest('http://localhost:3000/api/users/user-123/recovery-link', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'x-forwarded-for': '10.0.0.2',
      'x-real-ip': '127.0.0.1',
      'x-csrf-token': 'test-csrf-token',
      cookie: 'alea-csrf-token=test-csrf-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ locale }),
  })
}

describe('POST /api/users/[id]/recovery-link', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    requireAdminMock.mockResolvedValue(makeAdminContext())
    generateRecoveryLinkMock.mockResolvedValue({
      recoveryLink: 'http://localhost:3000/en/recover?token=abc',
      expiresAt: '2026-04-16T10:00:00.000Z',
    })
  })

  it('returns a generated recovery link for admins', async () => {
    const { POST } = await import('@/app/api/users/[id]/recovery-link/route')
    const response = await POST(createRequest('en'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      recoveryLink: 'http://localhost:3000/en/recover?token=abc',
      expiresAt: '2026-04-16T10:00:00.000Z',
    })
    expect(generateRecoveryLinkMock).toHaveBeenCalledWith({
      userId: 'user-123',
      locale: 'en',
      baseUrl: 'http://localhost:3000',
      createdBy: 'admin-1',
    })
  })

  it('maps service failures to HTTP errors', async () => {
    const { ServiceError } = await import('@/lib/server/service-error')
    generateRecoveryLinkMock.mockRejectedValueOnce(new ServiceError('This member must activate the account before using recovery', 400))

    const { POST } = await import('@/app/api/users/[id]/recovery-link/route')
    const response = await POST(createRequest('es'), {
      params: Promise.resolve({ id: 'user-123' }),
    })

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      message: 'This member must activate the account before using recovery',
      statusCode: 400,
    })
  })
})
