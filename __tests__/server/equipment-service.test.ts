// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mock state ─────────────────────────────────────────────────────────────────
const maybeSingleMock = vi.fn()
const selectOrderMock = vi.fn()
const insertMock = vi.fn()
const updateEqMock = vi.fn()
const deleteEqMock = vi.fn()
const roomDefaultSelectMock = vi.fn()
const fetchExistingDefaultsMock = vi.fn()
const deleteRoomDefaultMock = vi.fn()
const insertRoomDefaultMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'equipment') {
        return {
          select: vi.fn(() => ({
            order: selectOrderMock,
          })),
        }
      }
      if (table === 'room_default_equipment') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              // returns the enriched rows for getRoomDefaultEquipment
              then: roomDefaultSelectMock,
            })),
          })),
        }
      }
      return {}
    }),
  })),

  createSupabaseServerAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'equipment') {
        return {
          select: vi.fn(() => ({
            order: selectOrderMock,
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: maybeSingleMock,
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: maybeSingleMock,
              })),
            })),
          })),
        }
      }
      if (table === 'room_default_equipment') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(fetchExistingDefaultsMock),
          })),
          delete: vi.fn(() => ({
            eq: deleteRoomDefaultMock,
          })),
          insert: vi.fn(insertRoomDefaultMock),
        }
      }
      return {}
    }),
  })),
}))

// ── Re-import helper (reset module cache between tests) ────────────────────────
async function loadModule() {
  vi.resetModules()
  return import('@/lib/server/equipment/equipment-service')
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const equipmentRow = {
  id: 'eq-1',
  name: 'Projector',
  description: 'HD projector',
  created_at: '2025-01-01T00:00:00.000Z',
}

// ── listEquipment ─────────────────────────────────────────────────────────────
describe('listEquipment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns mapped equipment list on success', async () => {
    selectOrderMock.mockResolvedValue({ data: [equipmentRow], error: null })
    const { listEquipment } = await loadModule()

    const result = await listEquipment()

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'eq-1', name: 'Projector', description: 'HD projector' })
  })

  it('returns empty array when no equipment exists', async () => {
    selectOrderMock.mockResolvedValue({ data: [], error: null })
    const { listEquipment } = await loadModule()

    const result = await listEquipment()

    expect(result).toEqual([])
  })

  it('throws 500 ServiceError when Supabase returns an error', async () => {
    selectOrderMock.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const { listEquipment } = await loadModule()

    await expect(listEquipment()).rejects.toMatchObject({ name: 'ServiceError', statusCode: 500 })
  })

  it('maps description: null to null (not empty string)', async () => {
    selectOrderMock.mockResolvedValue({
      data: [{ ...equipmentRow, description: null }],
      error: null,
    })
    const { listEquipment } = await loadModule()

    const result = await listEquipment()

    expect(result[0].description).toBeNull()
  })
})

// ── createEquipment ───────────────────────────────────────────────────────────
describe('createEquipment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({ data: equipmentRow, error: null })
  })

  it('returns created equipment on success', async () => {
    const { createEquipment } = await loadModule()

    const result = await createEquipment({ name: 'Projector', description: 'HD projector' })

    expect(result).toMatchObject({ id: 'eq-1', name: 'Projector' })
  })

  it('throws 400 when name is empty string', async () => {
    const { createEquipment } = await loadModule()

    await expect(createEquipment({ name: '' })).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
  })

  it('throws 400 when name is missing (undefined)', async () => {
    const { createEquipment } = await loadModule()

    await expect(createEquipment({})).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
  })

  it('trims whitespace from name', async () => {
    maybeSingleMock.mockResolvedValue({ data: { ...equipmentRow, name: 'Projector' }, error: null })
    const { createEquipment } = await loadModule()

    // Should not throw — whitespace-only is actually empty after trim
    await expect(createEquipment({ name: '   ' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 500 when insert returns DB error', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'insert failed' } })
    const { createEquipment } = await loadModule()

    await expect(createEquipment({ name: 'Projector' })).rejects.toMatchObject({ statusCode: 500 })
  })

  it('throws 500 when insert returns null data (unexpected)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    const { createEquipment } = await loadModule()

    await expect(createEquipment({ name: 'Projector' })).rejects.toMatchObject({ statusCode: 500 })
  })

  it('stores null description when description is falsy', async () => {
    maybeSingleMock.mockResolvedValue({ data: { ...equipmentRow, description: null }, error: null })
    const { createEquipment } = await loadModule()

    const result = await createEquipment({ name: 'Projector', description: '' })

    expect(result.description).toBeNull()
  })
})

// ── updateEquipment ───────────────────────────────────────────────────────────
describe('updateEquipment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({ data: { ...equipmentRow, name: 'Updated' }, error: null })
  })

  it('returns updated equipment on success', async () => {
    const { updateEquipment } = await loadModule()

    const result = await updateEquipment('eq-1', { name: 'Updated' })

    expect(result).toMatchObject({ name: 'Updated' })
  })

  it('throws 400 when name is explicitly set to empty string', async () => {
    const { updateEquipment } = await loadModule()

    await expect(updateEquipment('eq-1', { name: '' })).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when no updatable fields are provided', async () => {
    const { updateEquipment } = await loadModule()

    await expect(updateEquipment('eq-1', {})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 404 when equipment not found (null data)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    const { updateEquipment } = await loadModule()

    await expect(updateEquipment('nonexistent', { name: 'X' })).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 500 when DB returns error', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const { updateEquipment } = await loadModule()

    await expect(updateEquipment('eq-1', { name: 'X' })).rejects.toMatchObject({ statusCode: 500 })
  })

  it('sets description to null when passed null', async () => {
    maybeSingleMock.mockResolvedValue({ data: { ...equipmentRow, description: null }, error: null })
    const { updateEquipment } = await loadModule()

    const result = await updateEquipment('eq-1', { description: null })

    expect(result.description).toBeNull()
  })
})

// ── deleteEquipment ───────────────────────────────────────────────────────────
describe('deleteEquipment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({ data: { id: 'eq-1' }, error: null })
  })

  it('resolves without error when deletion succeeds', async () => {
    const { deleteEquipment } = await loadModule()

    await expect(deleteEquipment('eq-1')).resolves.toBeUndefined()
  })

  it('throws 404 when no row was deleted (equipment not found)', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })
    const { deleteEquipment } = await loadModule()

    await expect(deleteEquipment('nonexistent')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 500 when DB returns error', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'constraint violation' } })
    const { deleteEquipment } = await loadModule()

    await expect(deleteEquipment('eq-1')).rejects.toMatchObject({ statusCode: 500 })
  })
})

// ── getRoomDefaultEquipment ───────────────────────────────────────────────────
describe('getRoomDefaultEquipment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns equipment items for a room', async () => {
    roomDefaultSelectMock.mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: [{ equipment_id: 'eq-1', equipment: equipmentRow }], error: null })
    )
    const { getRoomDefaultEquipment } = await loadModule()

    const result = await getRoomDefaultEquipment('room-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 'eq-1', name: 'Projector' })
  })

  it('filters out null equipment entries', async () => {
    roomDefaultSelectMock.mockImplementation((resolve: (v: unknown) => void) =>
      resolve({
        data: [{ equipment_id: 'eq-missing', equipment: null }],
        error: null,
      })
    )
    const { getRoomDefaultEquipment } = await loadModule()

    const result = await getRoomDefaultEquipment('room-1')

    expect(result).toHaveLength(0)
  })

  it('throws 500 when Supabase returns error', async () => {
    roomDefaultSelectMock.mockImplementation((resolve: (v: unknown) => void) =>
      resolve({ data: null, error: { message: 'RLS denied' } })
    )
    const { getRoomDefaultEquipment } = await loadModule()

    await expect(getRoomDefaultEquipment('room-1')).rejects.toMatchObject({ statusCode: 500 })
  })
})

// ── setRoomDefaultEquipment ───────────────────────────────────────────────────
describe('setRoomDefaultEquipment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    fetchExistingDefaultsMock.mockResolvedValue({ data: [], error: null })
    deleteRoomDefaultMock.mockReturnValue(Promise.resolve({ error: null }))
    insertRoomDefaultMock.mockResolvedValue({ error: null })
  })

  it('clears defaults when equipmentIds is empty', async () => {
    const { setRoomDefaultEquipment } = await loadModule()

    await expect(setRoomDefaultEquipment('room-1', [])).resolves.toBeUndefined()
    // fetchExistingDefaults should NOT be called when list is empty
    expect(fetchExistingDefaultsMock).not.toHaveBeenCalled()
  })

  it('inserts new defaults when no conflicts exist', async () => {
    fetchExistingDefaultsMock.mockResolvedValue({ data: [], error: null })
    const { setRoomDefaultEquipment } = await loadModule()

    await expect(setRoomDefaultEquipment('room-1', ['eq-1', 'eq-2'])).resolves.toBeUndefined()
    expect(insertRoomDefaultMock).toHaveBeenCalled()
  })

  it('throws 400 EQUIPMENT_LOCKED_TO_ANOTHER_ROOM when equipment belongs to another room', async () => {
    fetchExistingDefaultsMock.mockResolvedValue({
      data: [{ equipment_id: 'eq-1', room_id: 'room-99' }],
      error: null,
    })
    const { setRoomDefaultEquipment } = await loadModule()

    await expect(setRoomDefaultEquipment('room-1', ['eq-1'])).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
      message: 'EQUIPMENT_LOCKED_TO_ANOTHER_ROOM',
    })
  })

  it('allows re-assigning equipment already locked to the same room', async () => {
    fetchExistingDefaultsMock.mockResolvedValue({
      data: [{ equipment_id: 'eq-1', room_id: 'room-1' }],
      error: null,
    })
    const { setRoomDefaultEquipment } = await loadModule()

    // Same room — should not be treated as a conflict
    await expect(setRoomDefaultEquipment('room-1', ['eq-1'])).resolves.toBeUndefined()
  })

  it('throws 500 when the conflict-check query fails', async () => {
    fetchExistingDefaultsMock.mockResolvedValue({ data: null, error: { message: 'DB failure' } })
    const { setRoomDefaultEquipment } = await loadModule()

    await expect(setRoomDefaultEquipment('room-1', ['eq-1'])).rejects.toMatchObject({ statusCode: 500 })
  })

  it('throws 500 when the delete step fails', async () => {
    fetchExistingDefaultsMock.mockResolvedValue({ data: [], error: null })
    deleteRoomDefaultMock.mockReturnValue(Promise.resolve({ error: { message: 'delete failed' } }))
    const { setRoomDefaultEquipment } = await loadModule()

    await expect(setRoomDefaultEquipment('room-1', ['eq-1'])).rejects.toMatchObject({ statusCode: 500 })
  })

  it('throws 500 when the insert step fails', async () => {
    fetchExistingDefaultsMock.mockResolvedValue({ data: [], error: null })
    insertRoomDefaultMock.mockResolvedValue({ error: { message: 'insert failed' } })
    const { setRoomDefaultEquipment } = await loadModule()

    await expect(setRoomDefaultEquipment('room-1', ['eq-1'])).rejects.toMatchObject({ statusCode: 500 })
  })
})
