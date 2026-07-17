import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()

describe('api client', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn(async () => ({ ok: true })),
    })
  })

  it('adds the CSRF header automatically for unsafe requests', async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'alea-csrf-token=test-csrf-token',
    })

    const { apiClient } = await import('@/lib/api/client')

    await apiClient.post('/auth/login', { identifier: '100001', password: 'secret' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-csrf-token': 'test-csrf-token',
        }),
      }),
    )
  })

  it('reads cookies without requiring a semicolon-space delimiter', async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'other=value;alea-csrf-token=test-csrf-token',
    })

    const { apiClient } = await import('@/lib/api/client')

    await apiClient.post('/auth/login', { identifier: '100001', password: 'secret' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-csrf-token': 'test-csrf-token',
        }),
      }),
    )
  })

  it('preserves the CSRF header when callers pass additional headers', async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'alea-csrf-token=test-csrf-token',
    })

    const { apiClient } = await import('@/lib/api/client')

    await apiClient.post(
      '/auth/login',
      { identifier: '100001', password: 'secret' },
      { headers: { 'x-trace-id': 'trace-1' } },
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-csrf-token': 'test-csrf-token',
          'x-trace-id': 'trace-1',
        }),
      }),
    )
  })

  it('sends FormData without forcing application/json', async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'alea-csrf-token=test-csrf-token',
    })

    const { apiClient } = await import('@/lib/api/client')
    const formData = new FormData()
    formData.append('file', new Blob(['USUARIOS,ID\nJohn Doe,100001\n'], { type: 'text/csv' }), 'members.csv')

    await apiClient.post('/users/import', formData)

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/import',
      expect.objectContaining({
        method: 'POST',
        body: formData,
        headers: expect.not.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('does not throw when FormData is unavailable in the runtime', async () => {
    const originalFormData = globalThis.FormData
    // @ts-expect-error test-only runtime override
    delete globalThis.FormData

    try {
      const { apiClient } = await import('@/lib/api/client')

      await apiClient.post('/auth/login', { identifier: '100001', password: 'secret' })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ identifier: '100001', password: 'secret' }),
        }),
      )
    } finally {
      globalThis.FormData = originalFormData
    }
  })
})
