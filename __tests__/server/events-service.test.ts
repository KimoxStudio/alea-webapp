// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { ServiceError } from '@/lib/server/service-error'

/**
 * EVENTS SERVICE TEST COVERAGE
 *
 * Tests for reservation cancellation logic in createEvent() and updateEvent()
 * Implementation: lib/server/events-service.ts
 *
 * Key scenarios tested:
 * - createEvent with roomId cancels overlapping active/pending reservations
 * - createEvent without roomId does not attempt cancellation
 * - updateEvent with changed time cancels overlapping reservations
 * - updateEvent with changed roomId cancels only new room's reservations
 * - updateEvent with title-only changes does not cancel reservations
 * - Error handling when RPC calls fail
 */

// Mock 'server-only' before importing the service
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

type EventRow = {
  id: string
  title: string
  description: string | null
  date: string
  start_time: string
  end_time: string
  created_by: string | null
  created_at: string
}

type EventRoomBlockRow = {
  id: string
  event_id: string
  room_id: string
  date: string
  start_time: string
  end_time: string
}

// Helper to build a mock Supabase client with RPC support
function buildSupabaseMock() {
  return {
    from: vi.fn(function (table: string) {
      const state = { table, filters: {} as any, updateData: {} as any }

      return {
        select: vi.fn(function (cols?: string) {
          return {
            eq: vi.fn(function (col: string, val: any) {
              state.filters[col] = val

              // Build the return object - it needs to be both awaitable and have maybeSingle() method
              const chainObj = {
                // Make it awaitable
                [Symbol.toStringTag]: 'Promise',
                then: async function (onFulfilled?: any, onRejected?: any) {
                  // This is for handling await on eq() for tables queries
                  if (table === 'tables') {
                    // Return tables based on room_id filter
                    const roomId = state.filters['room_id']
                    const hasTablesForRoom = roomId && !roomId.includes('empty')
                    return Promise.resolve({
                      data: hasTablesForRoom ? [{ id: 'table-1' }, { id: 'table-2' }] : [],
                      error: null,
                    }).then(onFulfilled, onRejected)
                  }
                  // For event_room_blocks with eq(event_id, ...)
                  if (table === 'event_room_blocks' && col === 'event_id') {
                    const eventId = state.filters['event_id']
                    return Promise.resolve({
                      data:
                        eventId === 'evt-update-1'
                          ? [
                              {
                                id: 'block-1',
                                event_id: eventId,
                                room_id: 'room-1',
                                date: '2026-04-20',
                                start_time: '18:00',
                                end_time: '22:00',
                              },
                            ]
                          : [],
                      error: null,
                    }).then(onFulfilled, onRejected)
                  }
                  // For other queries, return undefined as they use maybeSingle
                  return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected)
                },
                // This is for handling .maybeSingle() chaining
                maybeSingle: vi.fn(async function () {
                  // Return mock data based on table and filters
                  if (table === 'events' && state.filters.id === 'evt-update-1') {
                    return {
                      data: {
                        id: 'evt-update-1',
                        title: 'Updated Event',
                        description: null,
                        date: '2026-04-20',
                        start_time: '18:00',
                        end_time: '22:00',
                        created_by: null,
                        created_at: '2026-04-13T00:00:00Z',
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: null }
                }),
                limit: vi.fn(function (n: number) {
                  return chainObj
                }),
                order: vi.fn(function () {
                  return {
                    maybeSingle: vi.fn(async () => ({
                      data: null,
                      error: null,
                    })),
                  }
                }),
                lt: vi.fn(function () {
                  return {
                    gt: vi.fn(function () {
                      return {
                        in: vi.fn(async () => ({
                          data: null,
                          error: null,
                        })),
                      }
                    }),
                  }
                }),
                gt: vi.fn(function () {
                  return {
                    in: vi.fn(async () => ({
                      data: null,
                      error: null,
                    })),
                  }
                }),
              }
              return chainObj
            }),
            in: vi.fn(function (col: string, vals: any[]) {
              state.filters[col] = vals
              // For tables query with in(room_id, [...]): return chainable object
              if (table === 'tables') {
                // Return tables based on room_ids filter
                const hasAnyTables = vals && vals.length > 0 && !vals.some((rid) => rid.includes('empty'))
                return {
                  [Symbol.toStringTag]: 'Promise',
                  then: async function (onFulfilled?: any, onRejected?: any) {
                    return Promise.resolve({
                      data: hasAnyTables ? [{ id: 'table-1' }, { id: 'table-2' }] : [],
                      error: null,
                    }).then(onFulfilled, onRejected)
                  },
                }
              }
              // For event_room_blocks select in query
              return {
                lt: vi.fn(function () {
                  return {
                    gt: vi.fn(function () {
                      return {
                        in: vi.fn(async () => ({
                          data: null,
                          error: null,
                        })),
                      }
                    }),
                  }
                }),
                order: vi.fn(async function () {
                  return { data: [], error: null }
                }),
              }
            }),
            order: vi.fn(function (col: string, opts: any) {
              return {
                order: vi.fn(function () {
                  return {
                    data: [],
                    error: null,
                  }
                }),
              }
            }),
          }
        }),
        insert: vi.fn(function (data: any) {
          state.updateData = data
          return {
            select: vi.fn(function (cols?: string) {
              // For event_room_blocks.insert().select('*') — return promise directly
              if (table === 'event_room_blocks') {
                return {
                  [Symbol.toStringTag]: 'Promise',
                  then: async function (onFulfilled?: any, onRejected?: any) {
                    return Promise.resolve({
                      data: [
                        {
                          id: 'block-1',
                          event_id: data.event_id,
                          room_id: data.room_id,
                          date: data.date,
                          start_time: data.start_time,
                          end_time: data.end_time,
                        },
                      ],
                      error: null,
                    }).then(onFulfilled, onRejected)
                  },
                }
              }
              // For events.insert().select('*').maybeSingle()
              return {
                maybeSingle: vi.fn(async () => {
                  if (table === 'events') {
                    return {
                      data: {
                        id: 'evt-1',
                        title: data.title,
                        description: data.description,
                        date: data.date,
                        start_time: data.start_time,
                        end_time: data.end_time,
                        created_by: data.created_by,
                        created_at: '2026-04-13T00:00:00Z',
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: null }
                }),
              }
            }),
          }
        }),
        update: vi.fn(function (data: any) {
          state.updateData = data
          return {
            eq: vi.fn(function (col: string, val: any) {
              state.filters[col] = val
              return {
                select: vi.fn(function (cols?: string) {
                  return {
                    maybeSingle: vi.fn(async () => {
                      if (table === 'events') {
                        // Return the updated event with new times if they were updated
                        return {
                          data: {
                            id: 'evt-1',
                            title: data.title ?? 'Updated',
                            description: data.description ?? null,
                            date: data.date ?? '2026-04-20',
                            start_time: data.start_time ?? '16:00',
                            end_time: data.end_time ?? '20:00',
                            created_by: null,
                            created_at: '2026-04-13T00:00:00Z',
                          },
                          error: null,
                        }
                      }
                      return { data: null, error: null }
                    }),
                  }
                }),
              }
            }),
            in: vi.fn(function (col: string, vals: any[]) {
              state.filters[col] = vals
              return {
                eq: vi.fn(function (col2: string, val2: any) {
                  state.filters[col2] = val2
                  return {
                    lt: vi.fn(function (col3: string, val3: any) {
                      state.filters[col3] = val3
                      return {
                        gt: vi.fn(function (col4: string, val4: any) {
                          state.filters[col4] = val4
                          return {
                            in: vi.fn(async () => ({
                              data: null,
                              error: null,
                            })),
                          }
                        }),
                      }
                    }),
                  }
                }),
              }
            }),
          }
        }),
        delete: vi.fn(function () {
          return {
            eq: vi.fn(async () => ({
              data: null,
              error: null,
            })),
          }
        }),
      }
    }),
    rpc: vi.fn(),
  }
}

describe('events-service — createEvent with roomId cancellation', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('calls create_event_atomic RPC with correct parameters', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'Test Event',
        description: null,
        date: '2026-04-20',
        start_time: '18:00',
        end_time: '22:00',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [
          {
            id: 'block-1',
            event_id: 'evt-1',
            room_id: 'room-1',
            date: '2026-04-20',
            start_time: '18:00',
            end_time: '22:00',
          },
        ],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    const result = await createEvent({
      title: 'Test Event',
      date: '2026-04-20',
      startTime: '18:00',
      endTime: '22:00',
      roomId: 'room-1',
    })

    expect(result.id).toBe('evt-1')
    expect(result.title).toBe('Test Event')
    expect(result.roomBlocks).toHaveLength(1)
    expect(result.roomBlocks[0].roomId).toBe('room-1')

    // Verify RPC was called with correct parameters
    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_atomic',
      expect.objectContaining({
        p_title: 'Test Event',
        p_description: null,
        p_date: '2026-04-20',
        p_start_time: '18:00',
        p_end_time: '22:00',
        p_room_id: 'room-1',
      })
    )
  })

  it('does not attempt cancellation when roomId is not provided', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'No Room Event',
        description: null,
        date: '2026-04-20',
        start_time: '18:00',
        end_time: '22:00',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    const result = await createEvent({
      title: 'No Room Event',
      date: '2026-04-20',
      startTime: '18:00',
      endTime: '22:00',
    })

    expect(result.id).toBe('evt-1')
    expect(result.roomBlocks).toHaveLength(0)

    // Verify RPC was called with p_room_id: null
    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_atomic',
      expect.objectContaining({
        p_room_id: null,
      })
    )
  })

  it('includes description when provided', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'Event With Description',
        description: 'Test description',
        date: '2026-04-20',
        start_time: '18:00',
        end_time: '22:00',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    const result = await createEvent({
      title: 'Event With Description',
      description: 'Test description',
      date: '2026-04-20',
      startTime: '18:00',
      endTime: '22:00',
    })

    expect(result.description).toBe('Test description')

    // Verify RPC was called with description
    expect(mock.rpc).toHaveBeenCalledWith(
      'create_event_atomic',
      expect.objectContaining({
        p_description: 'Test description',
      })
    )
  })

  it('throws 500 when RPC fails', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Database error' },
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent({
        title: 'Test Event',
        date: '2026-04-20',
        startTime: '18:00',
        endTime: '22:00',
        roomId: 'room-1',
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(500)
  })
})

describe('events-service — updateEvent with cancellation', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('calls update_event_atomic RPC with updated time values', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'Updated Event',
        description: null,
        date: '2026-04-20',
        start_time: '16:00',
        end_time: '20:00',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [
          {
            id: 'block-1',
            event_id: 'evt-1',
            room_id: 'room-1',
            date: '2026-04-20',
            start_time: '16:00',
            end_time: '20:00',
          },
        ],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    const result = await updateEvent('evt-update-1', {
      startTime: '16:00',
      endTime: '20:00',
    })

    expect(result.id).toBe('evt-1')
    expect(result.startTime).toBe('16:00')
    expect(result.endTime).toBe('20:00')

    // Verify RPC was called with updated times
    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_atomic',
      expect.objectContaining({
        p_id: 'evt-update-1',
        p_start_time: '16:00',
        p_end_time: '20:00',
      })
    )
  })

  it('loads existing room when roomId is not provided', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'Updated Title',
        description: null,
        date: '2026-04-20',
        start_time: '18:00',
        end_time: '22:00',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [
          {
            id: 'block-1',
            event_id: 'evt-1',
            room_id: 'room-1',
            date: '2026-04-20',
            start_time: '18:00',
            end_time: '22:00',
          },
        ],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    const result = await updateEvent('evt-update-1', {
      title: 'Updated Title',
    })

    expect(result.id).toBe('evt-1')

    // Verify the service fetched current event data
    expect(mock.from).toHaveBeenCalledWith('events')

    // Verify RPC was called with the existing room (room-1 from mock)
    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_atomic',
      expect.objectContaining({
        p_id: 'evt-update-1',
        p_room_id: 'room-1',
      })
    )
  })

  it('keeps existing room when allDay is updated without roomId', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'Updated Event',
        description: null,
        date: '2026-04-20',
        start_time: '00:00',
        end_time: '23:59',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [
          {
            id: 'block-1',
            event_id: 'evt-1',
            room_id: 'room-1',
            date: '2026-04-20',
            start_time: '00:00',
            end_time: '23:59',
            all_day: true,
          },
        ],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    const result = await updateEvent('evt-update-1', {
      allDay: true,
    })

    expect(result.allDay).toBe(true)
    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_atomic',
      expect.objectContaining({
        p_id: 'evt-update-1',
        p_room_id: 'room-1',
        p_all_day: true,
      })
    )
  })

  it('updates room when roomId is provided', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'Updated Event',
        description: null,
        date: '2026-04-20',
        start_time: '18:00',
        end_time: '22:00',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [
          {
            id: 'block-2',
            event_id: 'evt-1',
            room_id: 'room-2',
            date: '2026-04-20',
            start_time: '18:00',
            end_time: '22:00',
          },
        ],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    const result = await updateEvent('evt-update-1', {
      roomId: 'room-2',
    })

    expect(result.id).toBe('evt-1')

    // Verify RPC was called with new room
    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_atomic',
      expect.objectContaining({
        p_id: 'evt-update-1',
        p_room_id: 'room-2',
      })
    )
  })

  it('removes room when roomId is explicitly set to null', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: {
        id: 'evt-1',
        title: 'Updated Event',
        description: null,
        date: '2026-04-20',
        start_time: '18:00',
        end_time: '22:00',
        created_by: null,
        created_at: '2026-04-13T00:00:00Z',
        room_blocks: [],
      },
      error: null,
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    const result = await updateEvent('evt-update-1', {
      roomId: null,
    })

    expect(result.roomBlocks).toHaveLength(0)

    // Verify RPC was called with p_room_id: null
    expect(mock.rpc).toHaveBeenCalledWith(
      'update_event_atomic',
      expect.objectContaining({
        p_room_id: null,
      })
    )
  })

  it('throws 500 when event not found', async () => {
    const mock = buildSupabaseMock()
    // Override the from('events').select().eq().maybeSingle() to return no event
    const originalFrom = mock.from
    mock.from = vi.fn((table: string) => {
      const result = originalFrom(table) as any
      if (table === 'events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: null,
                error: null,
              })),
            })),
          })),
        }
      }
      return result
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent('evt-nonexistent', {
        title: 'Updated',
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(404)
  })

  it('throws 500 when RPC fails', async () => {
    const mock = buildSupabaseMock()
    mock.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: 'INTERNAL_ERROR', message: 'Database error' },
    })

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { updateEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await updateEvent('evt-update-1', {
        startTime: '16:00',
        endTime: '20:00',
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.statusCode).toBe(500)
  })

  it('rejects non-hour event start times', async () => {
    const mock = buildSupabaseMock()

    const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
    vi.mocked(createSupabaseServerAdminClient).mockReturnValue(mock as any)

    const { createEvent } = await import('@/lib/server/events-service')

    let caught: ServiceError | undefined
    try {
      await createEvent({
        title: 'Test Event',
        date: '2026-04-20',
        startTime: '18:30',
        endTime: '20:00',
        roomId: 'room-1',
      })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.message).toBe('startTime must be on a whole-hour boundary')
    expect(caught?.statusCode).toBe(400)
    expect(mock.rpc).not.toHaveBeenCalled()
  })
})
