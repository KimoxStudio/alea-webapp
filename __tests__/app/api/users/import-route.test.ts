import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const requireAdminMock = vi.fn()
const importMembersFromCsvMock = vi.fn()
const enforceMutationSecurityMock = vi.fn()
const enforceRateLimitMock = vi.fn()

vi.mock('@/lib/server/auth', () => ({
  requireAdmin: requireAdminMock,
}))

vi.mock('@/lib/server/users-service', () => ({
  importMembersFromCsv: importMembersFromCsvMock,
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

function makeAdminContext() {
  return {
    session: { id: 'admin-1', role: 'admin' as const },
    applyCookies: (response: NextResponse) => response,
  }
}

type ImportTestFile = {
  name: string
  size: number
  type: string
  text: () => Promise<string>
}

function createImportRequest(file?: ImportTestFile | null) {
  const request = new NextRequest('http://localhost:3000/api/users/import', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'x-forwarded-for': '10.0.0.1',
      'x-real-ip': '127.0.0.1',
    },
  })

  Object.defineProperty(request, 'formData', {
    value: async () => ({
      get: (key: string) => (key === 'file' ? file ?? null : null),
    }),
  })

  return request
}

describe('POST /api/users/import', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    enforceMutationSecurityMock.mockReturnValue(null)
    enforceRateLimitMock.mockReturnValue(null)
    requireAdminMock.mockResolvedValue(makeAdminContext())
    importMembersFromCsvMock.mockResolvedValue({
      totalRows: 1,
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0,
      normalizedRows: [],
      issues: [],
    })
  })

  it('returns 200 and delegates to the import service', async () => {
    const { POST } = await import('@/app/api/users/import/route')
    const request = createImportRequest(
      {
        name: 'members.csv',
        size: 28,
        type: 'text/csv',
        text: async () => 'USUARIOS,ID\nJohn Doe,100001\n',
      }
    )

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(importMembersFromCsvMock).toHaveBeenCalledWith('USUARIOS,ID\nJohn Doe,100001')
  })

  it('returns 400 when no file is provided', async () => {
    const { POST } = await import('@/app/api/users/import/route')
    const response = await POST(createImportRequest())

    expect(response.status).toBe(400)
    expect(importMembersFromCsvMock).not.toHaveBeenCalled()
  })

  it('returns 400 when file type is not supported', async () => {
    const { POST } = await import('@/app/api/users/import/route')
    const response = await POST(createImportRequest({
      name: 'members.json',
      size: 20,
      type: 'application/json',
      text: async () => '{"bad":true}',
    }))

    expect(response.status).toBe(400)
    expect(importMembersFromCsvMock).not.toHaveBeenCalled()
  })

  it('returns 400 when file is too large', async () => {
    const { POST } = await import('@/app/api/users/import/route')
    const response = await POST(createImportRequest({
      name: 'members.csv',
      size: 6 * 1024 * 1024,
      type: 'text/csv',
      text: async () => 'USUARIOS,ID\nJohn Doe,100001\n',
    }))

    expect(response.status).toBe(400)
    expect(importMembersFromCsvMock).not.toHaveBeenCalled()
  })

  it('returns security error before auth when mutation security fails', async () => {
    enforceMutationSecurityMock.mockReturnValue(
      NextResponse.json({ message: 'Forbidden' }, { status: 403 })
    )

    const { POST } = await import('@/app/api/users/import/route')
    const response = await POST(createImportRequest())

    expect(response.status).toBe(403)
    expect(requireAdminMock).not.toHaveBeenCalled()
  })

  it('returns auth error when admin session is missing', async () => {
    requireAdminMock.mockResolvedValue(
      NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 })
    )

    const { POST } = await import('@/app/api/users/import/route')
    const response = await POST(createImportRequest())

    expect(response.status).toBe(401)
    expect(importMembersFromCsvMock).not.toHaveBeenCalled()
  })
})
