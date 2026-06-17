// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createSupabaseServerAdminClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient,
}))

async function loadModule() {
  return import('@/lib/server/database-time')
}

describe('database-time', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns the parsed database timestamp from rpc', async () => {
    createSupabaseServerAdminClient.mockReturnValue({
      rpc: vi.fn(async () => ({ data: '2026-04-15T16:00:00.000Z', error: null })),
    })

    const { getDatabaseNow } = await loadModule()

    await expect(getDatabaseNow()).resolves.toEqual(new Date('2026-04-15T16:00:00.000Z'))
  })

  it('throws when the admin client cannot provide rpc access', async () => {
    createSupabaseServerAdminClient.mockReturnValue({})

    const { getDatabaseNow } = await loadModule()

    await expect(getDatabaseNow()).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 500,
    })
  })

  it('throws when rpc returns an unexpected payload', async () => {
    createSupabaseServerAdminClient.mockReturnValue({
      rpc: vi.fn(async () => undefined),
    })

    const { getDatabaseNow } = await loadModule()

    await expect(getDatabaseNow()).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 500,
    })
  })
})
