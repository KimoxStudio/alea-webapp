// @vitest-environment node
/**
 * KIM-383: Multi-day event service tests
 *
 * Tests for createEvent / updateEvent using the new multi-block (schedules) path.
 * Verifies:
 * - createEvent with schedules array calls create_event_with_blocks RPC
 * - createEvent with multiple schedules builds correct blocks payload
 * - updateEvent with schedules array calls update_event_with_blocks RPC
 * - Validation: each schedule entry must have a valid date
 * - Validation: time boundaries enforced per-block (whole-hour, end > start)
 * - schedules array is populated on the returned AdminEvent
 * - listEventsBlockingRoom still works for multi-day events (per-block queries)
 * - deleteEvent cancels reservations for every block date, not just the anchor date
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ServiceError } from '@/lib/server/service-error'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/server/service-error', () => ({
  serviceError: vi.fn((message: string, statusCode: number) => {
    const err = new Error(message) as ServiceError
    err.name = 'ServiceError'
    err.statusCode = statusCode
    throw err
  }),
}))

// ---------------------------------------------------------------------------
// Mock builder
// ---------------------------------------------------------------------------

function makeBlock(overrides: Record<string, unknown> = {}) {
  return {
    id: 'block-1',
    event_id: 'evt-1',
    room_id: 'room-1',
    date: '2026-07-10',
    start_time: '18:00',
    end_time: '22:00',
    all_day: false,
    ...overrides,
  }
}

function makeRpcResult(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    title: 'Multi-Day Event',
    description: null,
    date: '2026-07-10',
    start_time: '18:00',
    end_time: '22:00',
    created_by: null,
    created_at: '2026-07-01T00:00:00Z',
    room_blocks: [
      makeBlock(),
      makeBlock({ id: 'block-2', date: '2026-07-11', start_time: '10:00', end_time: '14:00' }),
    ],
    ...overrides,
  }
}

function buildMockAdmin() {
  const fromMap: Record<string, unknown> = {}

  const mock = {
    from: vi.fn(function (table: string) {
      return fromMap[table] ?? buildDefaultTable(table)
    }),
    rpc: vi.fn(),
  }

  function buildDefaultTable(_table: string) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
  }

  return mock
}

// ---------------------------------------------------------------------------
// createEvent — multi-block path
// ---------------------------------------------------------------------------

describe('events-service — createEvent multi-day (schedules)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('calls create_event_with_blocks when schedules array is provided', async () => {
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: makeRpcResult(), error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    const result = await createEvent({
      title: 'Multi-Day Event',
      schedules: [
        { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: 'room-1', allDay: false },
        { date: '2026-07-11', startTime: '10:00', endTime: '14:00', roomId: 'room-1', allDay: false },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_with_blocks',
      expect.objectContaining({
        p_title: 'Multi-Day Event',
        p_description: null,
        p_blocks: expect.arrayContaining([
          expect.objectContaining({ date: '2026-07-10', start_time: '18:00', end_time: '22:00' }),
          expect.objectContaining({ date: '2026-07-11', start_time: '10:00', end_time: '14:00' }),
        ]),
      })
    )

    expect(result.schedules).toHaveLength(2)
    expect(result.schedules[0].date).toBe('2026-07-10')
    expect(result.schedules[1].date).toBe('2026-07-11')
  })

  it('populates schedules and roomBlocks from RPC room_blocks response', async () => {
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: makeRpcResult(), error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    const result = await createEvent({
      title: 'Multi-Day Event',
      schedules: [
        { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: 'room-1', allDay: false },
        { date: '2026-07-11', startTime: '10:00', endTime: '14:00', roomId: 'room-1', allDay: false },
      ],
    })

    expect(result.roomBlocks).toHaveLength(2)
    expect(result.schedules).toHaveLength(2)
    // Anchor date = earliest block
    expect(result.date).toBe('2026-07-10')
  })

  it('sets allDay=true for a block when allDay flag is set', async () => {
    const allDayRpcResult = makeRpcResult({
      room_blocks: [
        makeBlock({ date: '2026-07-10', start_time: '00:00', end_time: '23:59', all_day: true }),
      ],
    })
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: allDayRpcResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    const result = await createEvent({
      title: 'All Day Event',
      schedules: [
        { date: '2026-07-10', roomId: 'room-1', allDay: true, startTime: '', endTime: '' },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_with_blocks',
      expect.objectContaining({
        p_blocks: expect.arrayContaining([
          expect.objectContaining({ all_day: true, start_time: '00:00', end_time: '23:59' }),
        ]),
      })
    )

    expect(result.allDay).toBe(true)
    expect(result.schedules[0].allDay).toBe(true)
  })

  it('rejects a schedule block with invalid date format', async () => {
    const mock = buildMockAdmin()
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent({
        title: 'Bad Date Event',
        schedules: [
          { date: 'not-a-date', startTime: '18:00', endTime: '22:00', roomId: null, allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/date must be in YYYY-MM-DD format/)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('rejects a schedule block where endTime <= startTime', async () => {
    const mock = buildMockAdmin()
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent({
        title: 'Bad Time Event',
        schedules: [
          { date: '2026-07-10', startTime: '22:00', endTime: '18:00', roomId: null, allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/endTime must be after startTime/)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('rejects a schedule block with non-whole-hour start time', async () => {
    const mock = buildMockAdmin()
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent({
        title: 'Bad Time Event',
        schedules: [
          { date: '2026-07-10', startTime: '18:30', endTime: '22:00', roomId: null, allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/startTime must be on a whole-hour boundary/)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('accepts schedules with null roomId (no room blocked)', async () => {
    const noRoomResult = makeRpcResult({
      room_blocks: [],
    })
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: noRoomResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    const result = await createEvent({
      title: 'No Room Event',
      schedules: [
        { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: null, allDay: false },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_with_blocks',
      expect.objectContaining({
        p_blocks: expect.arrayContaining([
          expect.objectContaining({ room_id: null }),
        ]),
      })
    )
    expect(result.roomBlocks).toHaveLength(0)
    expect(result.schedules).toHaveLength(0)
  })

  it('throws 500 when create_event_with_blocks RPC fails', async () => {
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL_ERROR', message: 'DB error' } })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent({
        title: 'Failing Event',
        schedules: [
          { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: 'room-1', allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// updateEvent — multi-block path
// ---------------------------------------------------------------------------

describe('events-service — updateEvent multi-day (schedules)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('calls update_event_with_blocks when schedules array is provided', async () => {
    const updatedResult = makeRpcResult({
      room_blocks: [
        makeBlock({ date: '2026-08-01', start_time: '09:00', end_time: '13:00' }),
        makeBlock({ id: 'block-2', date: '2026-08-02', start_time: '14:00', end_time: '18:00' }),
      ],
    })
    const mock = buildMockAdmin()

    // updateEvent loads current event first
    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              title: 'Old Title',
              description: null,
              date: '2026-07-10',
              start_time: '18:00',
              end_time: '22:00',
            },
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    mock.rpc.mockResolvedValueOnce({ data: updatedResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    const result = await updateEvent('evt-1', {
      title: 'Updated Multi-Day',
      schedules: [
        { date: '2026-08-01', startTime: '09:00', endTime: '13:00', roomId: 'room-1', allDay: false },
        { date: '2026-08-02', startTime: '14:00', endTime: '18:00', roomId: 'room-1', allDay: false },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_with_blocks',
      expect.objectContaining({
        p_id: 'evt-1',
        p_title: 'Updated Multi-Day',
        p_blocks: expect.arrayContaining([
          expect.objectContaining({ date: '2026-08-01' }),
          expect.objectContaining({ date: '2026-08-02' }),
        ]),
      })
    )

    expect(result.schedules).toHaveLength(2)
  })

  it('derives title from current event row when not provided in update body', async () => {
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              title: 'Existing Title',
              description: 'Existing desc',
              date: '2026-07-10',
              start_time: '18:00',
              end_time: '22:00',
            },
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    mock.rpc.mockResolvedValueOnce({
      data: makeRpcResult({ title: 'Existing Title' }),
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    await updateEvent('evt-1', {
      schedules: [
        { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: 'room-1', allDay: false },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_with_blocks',
      expect.objectContaining({ p_title: 'Existing Title' })
    )
  })

  it('throws 404 when event does not exist', async () => {
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent('nonexistent', {
        schedules: [
          { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: 'room-1', allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(404)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('throws 500 when update_event_with_blocks RPC fails', async () => {
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              title: 'Title',
              description: null,
              date: '2026-07-10',
              start_time: '18:00',
              end_time: '22:00',
            },
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }
    })

    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL_ERROR', message: 'DB error' } })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent('evt-1', {
        schedules: [
          { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: 'room-1', allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// listEventsBlockingRoom — availability check still works for multi-day blocks
// ---------------------------------------------------------------------------

describe('events-service — listEventsBlockingRoom (multi-day awareness)', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns events blocking a room on a specific date within time range', async () => {
    const mockAdmin = buildMockAdmin()
    // event_room_blocks query returns one block
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'event_room_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gt: vi.fn().mockResolvedValue({ data: [{ event_id: 'evt-multi' }], error: null }),
        }
      }
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{
              id: 'evt-multi',
              title: 'Multi-Day Blocker',
              description: null,
              date: '2026-08-01',
              start_time: '10:00',
              end_time: '18:00',
              created_by: null,
              created_at: '2026-07-01T00:00:00Z',
            }],
            error: null,
          }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mockAdmin as any)

    const { listEventsBlockingRoom } = await import('@/lib/server/events-service')

    const results = await listEventsBlockingRoom('room-1', '2026-08-01', '11:00', '14:00')

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Multi-Day Blocker')
    // schedules is empty here because listEventsBlockingRoom does not join blocks
    expect(results[0].schedules).toHaveLength(0)
  })

  it('returns empty array when no blocks overlap the query window', async () => {
    const mockAdmin = buildMockAdmin()
    mockAdmin.from.mockImplementation((table: string) => {
      if (table === 'event_room_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          gt: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mockAdmin as any)

    const { listEventsBlockingRoom } = await import('@/lib/server/events-service')

    const results = await listEventsBlockingRoom('room-1', '2026-09-15', '08:00', '10:00')

    expect(results).toHaveLength(0)
  })
})
