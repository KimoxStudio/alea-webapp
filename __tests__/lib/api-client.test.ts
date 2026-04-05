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

  it('preserves the CSRF header when callers pass custom headers', async () => {
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      value: 'alea-csrf-token=test-csrf-token',
    })

    const { apiClient } = await import('@/lib/api/client')

    await apiClient.post(
      '/auth/login',
      { identifier: '100001', password: 'secret' },
      {
        headers: {
          'x-trace-id': 'trace-123',
        },
      },
    )

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-csrf-token': 'test-csrf-token',
          'x-trace-id': 'trace-123',
        }),
      }),
    )
  })
})
