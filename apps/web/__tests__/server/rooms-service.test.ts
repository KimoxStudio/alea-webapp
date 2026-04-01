import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceError } from '@/lib/server/service-error'

async function loadRoomsModules() {
  vi.resetModules()

  const service = await import('@/lib/server/rooms-service')

  return { ...service }
}

describe('updateRoom', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws ServiceError with status 400 when tableCount is defined', async () => {
    const { updateRoom } = await loadRoomsModules()

    let caught: ServiceError | undefined
    try {
      updateRoom('1', { tableCount: 5 })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.name).toBe('ServiceError')
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/tableCount/i)
  })

  it('succeeds when tableCount is not provided (using seed room id "1")', async () => {
    const { updateRoom } = await loadRoomsModules()

    const updated = updateRoom('1', { name: 'Sala Mirkwood Updated' })

    expect(updated).not.toBeNull()
    expect(updated?.name).toBe('Sala Mirkwood Updated')
  })
})
