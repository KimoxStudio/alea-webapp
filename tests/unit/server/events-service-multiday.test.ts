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
import type { ServiceError } from '@/lib/server/shared/service-error'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/server/shared/service-error', () => ({
  serviceError: vi.fn((message: string, statusCode: number) => {
    const err = new Error(message) as ServiceError
    err.name = 'ServiceError'
    err.statusCode = statusCode
    throw err
  }),
}))

type SessionUser = { id: string; role: 'admin' | 'member'; email?: string }

function createAdminSession(): SessionUser {
  return { id: 'admin-1', role: 'admin', email: 'admin@example.com' }
}

function createMemberSession(): SessionUser {
  return { id: 'member-1', role: 'member', email: 'member@example.com' }
}


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

    const { createEvent } = await import('@/lib/server/events/events-service')

    const result = await createEvent(createAdminSession(), {
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
        p_created_by: null,
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

    const { createEvent } = await import('@/lib/server/events/events-service')

    const result = await createEvent(createAdminSession(), {
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

    const { createEvent } = await import('@/lib/server/events/events-service')

    const result = await createEvent(createAdminSession(), {
      title: 'All Day Event',
      schedules: [
        { date: '2026-07-10', roomId: 'room-1', allDay: true, startTime: '', endTime: '' },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_with_blocks',
      expect.objectContaining({
        p_created_by: null,
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

    const { createEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent(createAdminSession(), {
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

    const { createEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent(createAdminSession(), {
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

    const { createEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent(createAdminSession(), {
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

  it('accepts schedules with null roomId (no room blocked) — returns synthetic schedule entry', async () => {
    const noRoomResult = makeRpcResult({
      room_blocks: [],
    })
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: noRoomResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    const result = await createEvent(createAdminSession(), {
      title: 'No Room Event',
      schedules: [
        { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: null, allDay: false },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_with_blocks',
      expect.objectContaining({
        p_created_by: null,
        p_blocks: expect.arrayContaining([
          expect.objectContaining({ room_id: null }),
        ]),
      })
    )
    // No real room blocks (null-room blocks are not stored as room blocks)
    expect(result.roomBlocks).toHaveLength(0)
    // Service synthesises ONE schedule entry from the event anchor when no room blocks exist
    expect(result.schedules).toHaveLength(1)
    expect(result.schedules[0].roomId).toBeNull()
    expect(result.schedules[0].date).toBe('2026-07-10')
    expect(result.schedules[0].startTime).toBe('18:00')
    expect(result.schedules[0].endTime).toBe('22:00')
  })

  it('throws 500 when create_event_with_blocks RPC fails', async () => {
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'INTERNAL_ERROR', message: 'DB error' } })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent(createAdminSession(), {
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

  it('rejects empty schedules array with 400', async () => {
    const mock = buildMockAdmin()
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent(createAdminSession(), { title: 'Empty Schedules', schedules: [] })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/At least one schedule is required/)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('rejects schedules array with more than 366 entries with 400', async () => {
    const mock = buildMockAdmin()
    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    // Build 367 schedule entries
    const schedules = Array.from({ length: 367 }, (_, i) => {
      const dateStr = new Date(2026, 0, 1 + (i % 365)).toISOString().slice(0, 10)
      return { date: dateStr, startTime: '10:00', endTime: '12:00', roomId: 'room-1', allDay: false }
    })

    let caught: ServiceError | undefined
    try {
      await createEvent(createAdminSession(), { title: 'Too Many Blocks', schedules })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/Too many schedule blocks/)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('passes p_created_by when createdBy is provided in body', async () => {
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({
      data: makeRpcResult({ created_by: 'user-abc' }),
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    await createEvent(createAdminSession(), {
      title: 'Creator Event',
      createdBy: 'user-abc',
      schedules: [
        { date: '2026-09-01', startTime: '10:00', endTime: '12:00', roomId: 'room-1', allDay: false },
      ],
    })

    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_with_blocks',
      expect.objectContaining({ p_created_by: 'user-abc' })
    )
  })

  it('derives anchor date as earliest block and sorts schedules ascending when blocks are submitted out of order', async () => {
    // Blocks returned by RPC in non-chronological order: day 3, day 1, day 2
    const rpcResult = makeRpcResult({
      date: '2026-08-01',
      start_time: '09:00',
      end_time: '11:00',
      room_blocks: [
        makeBlock({ id: 'b3', date: '2026-08-03', start_time: '14:00', end_time: '16:00' }),
        makeBlock({ id: 'b1', date: '2026-08-01', start_time: '09:00', end_time: '11:00' }),
        makeBlock({ id: 'b2', date: '2026-08-02', start_time: '10:00', end_time: '12:00' }),
      ],
    })
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: rpcResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    const result = await createEvent(createAdminSession(), {
      title: 'Out Of Order',
      schedules: [
        { date: '2026-08-03', startTime: '14:00', endTime: '16:00', roomId: 'room-1', allDay: false },
        { date: '2026-08-01', startTime: '09:00', endTime: '11:00', roomId: 'room-1', allDay: false },
        { date: '2026-08-02', startTime: '10:00', endTime: '12:00', roomId: 'room-1', allDay: false },
      ],
    })

    // Anchor date is the earliest block
    expect(result.date).toBe('2026-08-01')
    // schedules sorted ascending by date
    expect(result.schedules).toHaveLength(3)
    expect(result.schedules[0].date).toBe('2026-08-01')
    expect(result.schedules[1].date).toBe('2026-08-02')
    expect(result.schedules[2].date).toBe('2026-08-03')
  })

  it('handles multi-room single-day event (two rooms, same day)', async () => {
    const rpcResult = makeRpcResult({
      date: '2026-10-01',
      start_time: '10:00',
      end_time: '14:00',
      room_blocks: [
        makeBlock({ id: 'b1', room_id: 'room-A', date: '2026-10-01', start_time: '10:00', end_time: '14:00' }),
        makeBlock({ id: 'b2', room_id: 'room-B', date: '2026-10-01', start_time: '10:00', end_time: '14:00' }),
      ],
    })
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: rpcResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    const result = await createEvent(createAdminSession(), {
      title: 'Multi-Room Single Day',
      schedules: [
        { date: '2026-10-01', startTime: '10:00', endTime: '14:00', roomId: 'room-A', allDay: false },
        { date: '2026-10-01', startTime: '10:00', endTime: '14:00', roomId: 'room-B', allDay: false },
      ],
    })

    expect(result.roomBlocks).toHaveLength(2)
    expect(result.schedules).toHaveLength(2)
    expect(result.date).toBe('2026-10-01')
    const roomIds = result.roomBlocks.map((b) => b.roomId)
    expect(roomIds).toContain('room-A')
    expect(roomIds).toContain('room-B')
  })

  it('maps PG check-constraint error 23514 to 400', async () => {
    const mock = buildMockAdmin()
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'check constraint' } })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent(createAdminSession(), {
        title: 'Constraint Fail',
        schedules: [
          { date: '2026-07-10', startTime: '10:00', endTime: '12:00', roomId: 'room-1', allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(400)
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

    const { updateEvent } = await import('@/lib/server/events/events-service')

    const result = await updateEvent(createAdminSession(), 'evt-1', {
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

    const { updateEvent } = await import('@/lib/server/events/events-service')

    await updateEvent(createAdminSession(), 'evt-1', {
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

    const { updateEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent(createAdminSession(), 'nonexistent', {
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

    const { updateEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent(createAdminSession(), 'evt-1', {
        schedules: [
          { date: '2026-07-10', startTime: '18:00', endTime: '22:00', roomId: 'room-1', allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(500)
  })

  it('rejects empty schedules array with 400 on update', async () => {
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              title: 'Existing',
              description: null,
              date: '2026-07-10',
              start_time: '10:00',
              end_time: '12:00',
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

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent(createAdminSession(), 'evt-1', { schedules: [] })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/At least one schedule is required/)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('rejects schedules array > 366 entries with 400 on update', async () => {
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              title: 'Existing',
              description: null,
              date: '2026-07-10',
              start_time: '10:00',
              end_time: '12:00',
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

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events/events-service')

    const schedules = Array.from({ length: 367 }, (_, i) => {
      const dateStr = new Date(2026, 0, 1 + (i % 365)).toISOString().slice(0, 10)
      return { date: dateStr, startTime: '10:00', endTime: '12:00', roomId: 'room-1', allDay: false }
    })

    let caught: ServiceError | undefined
    try {
      await updateEvent(createAdminSession(), 'evt-1', { schedules })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(400)
    expect(caught?.message).toMatch(/Too many schedule blocks/)
    expect(mock.rpc).not.toHaveBeenCalled()
  })

  it('shrinks block count from 2 to 1 and returns correct schedules', async () => {
    const shrunkResult = makeRpcResult({
      date: '2026-08-01',
      start_time: '09:00',
      end_time: '13:00',
      room_blocks: [
        makeBlock({ id: 'b1', date: '2026-08-01', start_time: '09:00', end_time: '13:00' }),
      ],
    })
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              title: 'Event',
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

    mock.rpc.mockResolvedValueOnce({ data: shrunkResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events/events-service')

    const result = await updateEvent(createAdminSession(), 'evt-1', {
      schedules: [
        { date: '2026-08-01', startTime: '09:00', endTime: '13:00', roomId: 'room-1', allDay: false },
      ],
    })

    expect(result.schedules).toHaveLength(1)
    expect(result.schedules[0].date).toBe('2026-08-01')
    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_with_blocks',
      expect.objectContaining({
        p_blocks: expect.arrayContaining([expect.objectContaining({ date: '2026-08-01' })]),
      })
    )
  })

  it('grows block count from 1 to 3 and returns correct schedules', async () => {
    const grownResult = makeRpcResult({
      date: '2026-09-01',
      start_time: '10:00',
      end_time: '14:00',
      room_blocks: [
        makeBlock({ id: 'b1', date: '2026-09-01', start_time: '10:00', end_time: '14:00' }),
        makeBlock({ id: 'b2', date: '2026-09-02', start_time: '10:00', end_time: '14:00' }),
        makeBlock({ id: 'b3', date: '2026-09-03', start_time: '10:00', end_time: '14:00' }),
      ],
    })
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              title: 'Growing Event',
              description: null,
              date: '2026-09-01',
              start_time: '10:00',
              end_time: '14:00',
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

    mock.rpc.mockResolvedValueOnce({ data: grownResult, error: null })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events/events-service')

    const result = await updateEvent(createAdminSession(), 'evt-1', {
      schedules: [
        { date: '2026-09-01', startTime: '10:00', endTime: '14:00', roomId: 'room-1', allDay: false },
        { date: '2026-09-02', startTime: '10:00', endTime: '14:00', roomId: 'room-1', allDay: false },
        { date: '2026-09-03', startTime: '10:00', endTime: '14:00', roomId: 'room-1', allDay: false },
      ],
    })

    expect(result.schedules).toHaveLength(3)
    expect(result.schedules[0].date).toBe('2026-09-01')
    expect(result.schedules[1].date).toBe('2026-09-02')
    expect(result.schedules[2].date).toBe('2026-09-03')
  })

  it('maps PG P0001 error to 404 on update', async () => {
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
              start_time: '10:00',
              end_time: '12:00',
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

    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0001', message: 'event not found' } })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent(createAdminSession(), 'evt-1', {
        schedules: [
          { date: '2026-07-10', startTime: '10:00', endTime: '12:00', roomId: 'room-1', allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(404)
  })

  it('maps PG check-constraint 23514 to 400 on update', async () => {
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
              start_time: '10:00',
              end_time: '12:00',
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

    mock.rpc.mockResolvedValueOnce({ data: null, error: { code: '23514', message: 'check constraint violated' } })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent(createAdminSession(), 'evt-1', {
        schedules: [
          { date: '2026-07-10', startTime: '10:00', endTime: '12:00', roomId: 'room-1', allDay: false },
        ],
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(400)
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

    const { listEventsBlockingRoom } = await import('@/lib/server/events/events-service')

    const results = await listEventsBlockingRoom('room-1', '2026-08-01', '11:00', '14:00')

    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Multi-Day Blocker')
    // listEventsBlockingRoom calls toAdminEvent(row, []) — no room blocks joined.
    // The service synthesises ONE schedule entry from the event anchor in that case.
    expect(results[0].schedules).toHaveLength(1)
    expect(results[0].schedules[0].roomId).toBeNull()
    expect(results[0].schedules[0].date).toBe('2026-08-01')
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

    const { listEventsBlockingRoom } = await import('@/lib/server/events/events-service')

    const results = await listEventsBlockingRoom('room-1', '2026-09-15', '08:00', '10:00')

    expect(results).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// deleteEvent — multi-day cancellation
// ---------------------------------------------------------------------------

describe('events-service — deleteEvent multi-day cancellation', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  /** Build a chainable mock for a table that resolves at the end of the chain. */
  function buildChainableMock(resolveWith: unknown = { data: null, error: null }) {
    const chain: Record<string, unknown> = {}
    const methods = ['select', 'eq', 'in', 'lt', 'gt', 'update', 'delete', 'limit']
    for (const m of methods) {
      chain[m] = vi.fn(() => chain)
    }
    ;(chain as any).maybeSingle = vi.fn().mockResolvedValue(resolveWith)
    return chain
  }

  it('cancels reservations for every block date (multi-day event)', async () => {
    const mock = buildMockAdmin()

    // Track calls to reservations.update
    const inStatusMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const gtEndTimeMock = vi.fn(() => ({ in: inStatusMock }))
    const ltStartTimeMock = vi.fn(() => ({ gt: gtEndTimeMock }))
    const eqDateMock = vi.fn(() => ({ lt: ltStartTimeMock }))
    const inTablesMock = vi.fn(() => ({ eq: eqDateMock }))
    const updateReturnMock = vi.fn(() => ({ in: inTablesMock }))

    let eventsDeleteCalled = false

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          delete: vi.fn(() => {
            eventsDeleteCalled = true
            return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
          }),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'evt-multi' }, error: null }),
        }
      }
      if (table === 'event_room_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { room_id: 'room-1', date: '2026-08-01', start_time: '10:00', end_time: '14:00' },
              { room_id: 'room-1', date: '2026-08-02', start_time: '10:00', end_time: '14:00' },
              { room_id: 'room-1', date: '2026-08-03', start_time: '10:00', end_time: '14:00' },
            ],
            error: null,
          }),
        }
      }
      if (table === 'tables') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'table-1', room_id: 'room-1' }],
            error: null,
          }),
        }
      }
      if (table === 'reservations') {
        return { update: updateReturnMock }
      }
      return buildChainableMock()
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { deleteEvent } = await import('@/lib/server/events/events-service')

    await deleteEvent(createAdminSession(), 'evt-multi')

    // update called once per block (3 blocks, each with a real room)
    expect(updateReturnMock).toHaveBeenCalledTimes(3)
    expect(updateReturnMock).toHaveBeenCalledWith({ status: 'cancelled' })
  })

  it('skips reservation cancellation for null-room blocks', async () => {
    const mock = buildMockAdmin()

    const updateReturnMock = vi.fn().mockReturnThis()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'evt-null' }, error: null }),
        }
      }
      if (table === 'event_room_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              // All blocks have null room_id
              { room_id: null, date: '2026-09-01', start_time: '10:00', end_time: '12:00' },
            ],
            error: null,
          }),
        }
      }
      if (table === 'tables') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'reservations') {
        return { update: updateReturnMock }
      }
      return buildChainableMock()
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { deleteEvent } = await import('@/lib/server/events/events-service')

    await deleteEvent(createAdminSession(), 'evt-null')

    // No reservations should be cancelled — null-room blocks have no tableIds
    expect(updateReturnMock).not.toHaveBeenCalled()
  })

  it('handles mixed null-room and real-room blocks — cancels only for real-room blocks', async () => {
    const mock = buildMockAdmin()

    const inStatusFn = vi.fn().mockResolvedValue({ data: null, error: null })
    const gtFn = vi.fn(() => ({ in: inStatusFn }))
    const ltFn = vi.fn(() => ({ gt: gtFn }))
    const eqFn = vi.fn(() => ({ lt: ltFn }))
    const inTablesFn = vi.fn(() => ({ eq: eqFn }))
    const updateFn = vi.fn(() => ({ in: inTablesFn }))

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'evt-mixed' }, error: null }),
        }
      }
      if (table === 'event_room_blocks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              { room_id: null,     date: '2026-10-01', start_time: '10:00', end_time: '12:00' },
              { room_id: 'room-1', date: '2026-10-02', start_time: '10:00', end_time: '12:00' },
              { room_id: null,     date: '2026-10-03', start_time: '10:00', end_time: '12:00' },
            ],
            error: null,
          }),
        }
      }
      if (table === 'tables') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [{ id: 'table-1', room_id: 'room-1' }],
            error: null,
          }),
        }
      }
      if (table === 'reservations') {
        return { update: updateFn }
      }
      return buildChainableMock()
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { deleteEvent } = await import('@/lib/server/events/events-service')

    await deleteEvent(createAdminSession(), 'evt-mixed')

    // Only the one real-room block (2026-10-02) triggers a reservation update
    expect(updateFn).toHaveBeenCalledTimes(1)
    expect(updateFn).toHaveBeenCalledWith({ status: 'cancelled' })
  })

  it('throws 404 when deleting a non-existent event', async () => {
    const mock = buildMockAdmin()

    mock.from.mockImplementation((table: string) => {
      if (table === 'events') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      return buildChainableMock()
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { deleteEvent } = await import('@/lib/server/events/events-service')

    let caught: ServiceError | undefined
    try {
      await deleteEvent(createAdminSession(), 'nonexistent')
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught?.statusCode).toBe(404)
  })

  // ============================================================
  // Member-role 403 Denial Tests for multi-day events
  // ============================================================

  describe('Member-role session denial for multi-day (schedules)', () => {
    it('createEvent with schedules array throws 403 when session role is member', async () => {
      const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
      const { serviceError } = await import('@/lib/server/service-error')

      const { createEvent } = await import('@/lib/server/events-service')

      let caught: ServiceError | undefined
      try {
        await createEvent(createMemberSession(), {
          title: 'Multi-Day Event',
          schedules: [
            {
              date: '2026-07-10',
              startTime: '18:00',
              endTime: '22:00',
              roomId: 'room-1',
            },
          ],
        })
      } catch (err) {
        caught = err as ServiceError
      }

      expect(caught).toBeDefined()
      expect(caught?.statusCode).toBe(403)
      expect(caught?.message).toBe('Forbidden')
    })

    it('updateEvent with schedules array throws 403 when session role is member', async () => {
      const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

      const { updateEvent } = await import('@/lib/server/events-service')

      let caught: ServiceError | undefined
      try {
        await updateEvent(createMemberSession(), 'evt-1', {
          schedules: [
            {
              date: '2026-07-10',
              startTime: '18:00',
              endTime: '22:00',
              roomId: 'room-1',
            },
          ],
        })
      } catch (err) {
        caught = err as ServiceError
      }

      expect(caught).toBeDefined()
      expect(caught?.statusCode).toBe(403)
      expect(caught?.message).toBe('Forbidden')
    })

    it('deleteEvent throws 403 when session role is member (multi-day context)', async () => {
      const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')

      const { deleteEvent } = await import('@/lib/server/events-service')

      let caught: ServiceError | undefined
      try {
        await deleteEvent(createMemberSession(), 'evt-multi-1')
      } catch (err) {
        caught = err as ServiceError
      }

      expect(caught).toBeDefined()
      expect(caught?.statusCode).toBe(403)
      expect(caught?.message).toBe('Forbidden')
    })
  })
})
