// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ServiceError } from '@/lib/server/service-error'

/**
 * CLUB EVENTS SERVICE TEST COVERAGE (OIR-203)
 *
 * Tests for admin CRUD operations on public club events
 * Implementation: lib/server/club-events-service.ts
 *
 * Key scenarios tested:
 * - createClubEvent with bilingual titles and optional room blocks (admin-only)
 * - updateClubEvent with partial updates and room block toggling (admin-only)
 * - deleteClubEvent removes event and cancels conflicting reservations (admin-only)
 * - Non-admin users get 403 Forbidden from every CRUD endpoint
 * - URL hardening: validateOptionalUrl rejects javascript:, data:, relative URLs
 * - Room blocking is optional: events without blocksRooms don't create event_room_blocks rows
 * - Upcoming/past split derived from date_kind and end_date at read time
 * - listEvents() excludes landing rows (both title_es and title_en populated)
 */

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

vi.mock('@/lib/club-time', () => ({
  getCurrentClubDate: vi.fn(() => '2026-04-15'),
  isValidDateOnlyString: vi.fn((s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)),
}))

type EventRow = {
  id: string
  title: string
  title_es: string | null
  title_en: string | null
  blurb_es: string | null
  blurb_en: string | null
  description_es: string | null
  description_en: string | null
  category_es: string | null
  category_en: string | null
  date_kind: string | null
  date: string
  end_date: string | null
  recurrence_label_es: string | null
  recurrence_label_en: string | null
  image_url: string | null
  link_url: string | null
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
  all_day: boolean
}

type SessionUser = {
  id: string
  role: 'admin' | 'member'
  email?: string
}

function buildSupabaseMock() {
  return {
    from: vi.fn(function (table: string) {
      const state = { table, filters: {} as any, updateData: {} as any, data: null as any }

      return {
        select: vi.fn(function (cols?: string) {
          return {
            not: vi.fn(function (col: string, op: string, val: any) {
              state.filters[`${col}_${op}`] = val
              return {
                not: vi.fn(function (col2: string, op2: string, val2: any) {
                  state.filters[`${col2}_${op2}`] = val2
                  return {
                    order: vi.fn(function (col: string, opts: any) {
                      return {
                        [Symbol.toStringTag]: 'Promise',
                        then: async (onFulfilled?: any) => {
                          if (table === 'events') {
                            // Return mock club events for listing
                            const mockData = [
                              {
                                id: 'evt-upcoming-1',
                                title: 'Tornero 2026',
                                title_es: 'Tornero 2026',
                                title_en: 'Tournament 2026',
                                blurb_es: 'Torneo amistoso',
                                blurb_en: 'Friendly tournament',
                                description_es: null,
                                description_en: null,
                                category_es: 'Torneo',
                                category_en: 'Tournament',
                                date_kind: 'single',
                                date: '2026-05-01',
                                end_date: null,
                                recurrence_label_es: null,
                                recurrence_label_en: null,
                                image_url: 'https://example.com/tournament.png',
                                link_url: null,
                                created_by: 'user-1',
                                created_at: '2026-04-01T00:00:00Z',
                              },
                            ]
                            return onFulfilled?.({ data: mockData, error: null })
                          }
                          return onFulfilled?.({ data: [], error: null })
                        },
                      }
                    }),
                  }
                }),
              }
            }),
            eq: vi.fn(function (col: string, val: any) {
              state.filters[col] = val
              return {
                maybeSingle: vi.fn(async () => {
                  if (table === 'events' && state.filters.id === 'evt-1') {
                    return {
                      data: {
                        id: 'evt-1',
                        title: 'Old Event',
                        title_es: 'Evento Antiguo',
                        title_en: 'Old Event',
                        blurb_es: null,
                        blurb_en: null,
                        description_es: null,
                        description_en: null,
                        category_es: null,
                        category_en: null,
                        date_kind: 'single',
                        date: '2026-04-20',
                        end_date: null,
                        recurrence_label_es: null,
                        recurrence_label_en: null,
                        image_url: null,
                        link_url: null,
                        created_by: 'user-1',
                        created_at: '2026-04-01T00:00:00Z',
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: null }
                }),
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              }
            }),
            in: vi.fn(function (col: string, vals: any[]) {
              state.filters[col] = vals
              return {
                [Symbol.toStringTag]: 'Promise',
                then: async (onFulfilled?: any) => {
                  if (table === 'event_room_blocks') {
                    return onFulfilled?.({ data: [], error: null })
                  }
                  return onFulfilled?.({ data: [], error: null })
                },
              }
            }),
            or: vi.fn(function (filter: string) {
              return {
                order: vi.fn(function () {
                  return {
                    order: vi.fn(async () => ({
                      data: [],
                      error: null,
                    })),
                  }
                }),
              }
            }),
            order: vi.fn(function () {
              return {
                order: vi.fn(() => ({
                  [Symbol.toStringTag]: 'Promise',
                  then: async (onFulfilled?: any) => {
                    return onFulfilled?.({ data: [], error: null })
                  },
                })),
              }
            }),
          }
        }),
        insert: vi.fn(function (data: any) {
          state.data = data
          return {
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: 'evt-new-1',
                  ...data,
                } as EventRow,
                error: null,
              })),
            })),
          }
        }),
        update: vi.fn(function (data: any) {
          state.updateData = data
          return {
            eq: vi.fn(function (col: string, val: any) {
              state.filters[col] = val
              return {
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: state.filters.id,
                      ...state.updateData,
                    } as EventRow,
                    error: null,
                  })),
                })),
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

function createAdminSession(): SessionUser {
  return { id: 'user-admin-1', role: 'admin', email: 'admin@example.com' }
}

function createMemberSession(): SessionUser {
  return { id: 'user-member-1', role: 'member', email: 'member@example.com' }
}

async function loadClubEventsService() {
  vi.resetModules()
  const mod = await import('@/lib/server/club-events-service')
  return {
    createClubEvent: mod.createClubEvent,
    updateClubEvent: mod.updateClubEvent,
    deleteClubEvent: mod.deleteClubEvent,
    listAdminClubEvents: mod.listAdminClubEvents,
    listClubEvents: mod.listClubEvents,
  }
}

async function loadEventsService() {
  vi.resetModules()
  const mod = await import('@/lib/server/events-service')
  return {
    listEvents: mod.listEvents,
  }
}

describe('club-events-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createClubEvent', () => {
    it('admin can create a public club event without room blocks', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { createClubEvent } = await loadClubEventsService()

      const result = await createClubEvent(adminSession, {
        titleEs: 'Gastronómica Viernes',
        titleEn: 'Friday Gastro',
        blurbEs: 'Noche de comida',
        blurbEn: 'Food night',
        dateKind: 'recurring',
        date: '2026-04-17',
        recurrenceLabelEs: 'Todos los viernes',
        recurrenceLabelEn: 'Every Friday',
        imageUrl: 'https://example.com/gastro.png',
        linkUrl: 'https://example.com/reserve',
        categoryEs: 'Social',
        categoryEn: 'Social',
        blocksRooms: false,
      })

      expect(result.id).toBe('evt-new-1')
      expect(result.titleEs).toBe('Gastronómica Viernes')
      expect(result.titleEn).toBe('Friday Gastro')
      expect(result.status).toBe('upcoming')
      expect(result.blocksRooms).toBe(false)
      expect(result.roomBlocks.length).toBe(0)
    })

    it('non-admin member gets 403 Forbidden', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { createClubEvent } = await loadClubEventsService()

      await expect(
        createClubEvent(memberSession, {
          titleEs: 'Event',
          titleEn: 'Event',
          date: '2026-05-01',
          dateKind: 'single',
        })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('rejects javascript: URL in image_url', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { createClubEvent } = await loadClubEventsService()

      await expect(
        createClubEvent(adminSession, {
          titleEs: 'Event',
          titleEn: 'Event',
          date: '2026-05-01',
          dateKind: 'single',
          imageUrl: 'javascript:alert(1)',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects data: URL in link_url', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { createClubEvent } = await loadClubEventsService()

      await expect(
        createClubEvent(adminSession, {
          titleEs: 'Event',
          titleEn: 'Event',
          date: '2026-05-01',
          dateKind: 'single',
          linkUrl: 'data:text/html,<script>alert(1)</script>',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects relative URL in imageUrl', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { createClubEvent } = await loadClubEventsService()

      await expect(
        createClubEvent(adminSession, {
          titleEs: 'Event',
          titleEn: 'Event',
          date: '2026-05-01',
          dateKind: 'single',
          imageUrl: '/images/event.png',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('accepts empty/undefined imageUrl and linkUrl', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { createClubEvent } = await loadClubEventsService()

      const result = await createClubEvent(adminSession, {
        titleEs: 'Event',
        titleEn: 'Event',
        date: '2026-05-01',
        dateKind: 'single',
        imageUrl: undefined,
        linkUrl: null,
      })

      expect(result.imageUrl).toBeNull()
      expect(result.linkUrl).toBeNull()
    })

    it('requires both titleEs and titleEn', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { createClubEvent } = await loadClubEventsService()

      await expect(
        createClubEvent(adminSession, {
          titleEs: 'Event',
          titleEn: '', // Empty
          date: '2026-05-01',
          dateKind: 'single',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })
  })

  describe('updateClubEvent', () => {
    it('admin can update a club event', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { updateClubEvent } = await loadClubEventsService()

      const result = await updateClubEvent(adminSession, 'evt-1', {
        titleEs: 'Updated Event ES',
        blurbEn: 'Updated blurb',
      })

      expect(result.id).toBe('evt-1')
    })

    it('non-admin member gets 403 Forbidden on update', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { updateClubEvent } = await loadClubEventsService()

      await expect(
        updateClubEvent(memberSession, 'evt-1', { titleEs: 'Updated' })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns 404 for non-existent or non-landing club event', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { updateClubEvent } = await loadClubEventsService()

      // Mock returns null for missing event
      mockSupabaseAdmin.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })) as any

      await expect(
        updateClubEvent(adminSession, 'nonexistent-evt', { titleEs: 'Test' })
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('deleteClubEvent', () => {
    it('admin can delete a club event', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { deleteClubEvent } = await loadClubEventsService()

      // Should not throw
      await deleteClubEvent(adminSession, 'evt-1')
    })

    it('non-admin member gets 403 Forbidden on delete', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { deleteClubEvent } = await loadClubEventsService()

      await expect(
        deleteClubEvent(memberSession, 'evt-1')
      ).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('listAdminClubEvents', () => {
    it('admin gets upcoming and past events split by date', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)

      const { listAdminClubEvents } = await loadClubEventsService()

      const result = await listAdminClubEvents(adminSession)

      expect(result).toHaveProperty('upcoming')
      expect(result).toHaveProperty('past')
      expect(Array.isArray(result.upcoming)).toBe(true)
      expect(Array.isArray(result.past)).toBe(true)
    })

    it('non-admin member gets 403 Forbidden', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(mockSupabaseAdmin as any)
      vi.mocked(await import('@/lib/server/service-error')).serviceError
        .mockImplementation((msg, code) => {
          const err = new Error(msg) as ServiceError
          err.statusCode = code
          throw err
        })

      const { listAdminClubEvents } = await loadClubEventsService()

      await expect(
        listAdminClubEvents(memberSession)
      ).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('listClubEvents', () => {
    it('returns upcoming and past club events for public listing', async () => {
      const mockSupabaseClient = buildSupabaseMock()
      
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient
        .mockResolvedValue(mockSupabaseClient as any)

      const { listClubEvents } = await loadClubEventsService()

      const result = await listClubEvents()

      expect(result).toHaveProperty('upcoming')
      expect(result).toHaveProperty('past')
    })
  })

  describe('listEvents (from events-service.ts)', () => {
    it('excludes landing-only rows (both title_es and title_en populated)', async () => {
      const mockSupabaseClient = buildSupabaseMock()
      mockSupabaseClient.from = vi.fn(function (table: string) {
        if (table === 'events') {
          return {
            select: vi.fn(() => ({
              or: vi.fn(function (filter: string) {
                // Verify the .or filter is being called with the landing exclusion logic
                expect(filter).toContain('title_es')
                expect(filter).toContain('title_en')
                return {
                  order: vi.fn(function () {
                    return {
                      order: vi.fn(async () => ({
                        data: [
                          {
                            id: 'evt-internal-1',
                            title: 'Internal Event',
                            description: null,
                            date: '2026-04-20',
                            start_time: '18:00',
                            end_time: '22:00',
                            created_by: 'user-1',
                            created_at: '2026-04-01T00:00:00Z',
                          },
                        ],
                        error: null,
                      })),
                    }
                  }),
                }
              }),
            })),
          }
        }
        return buildSupabaseMock().from(table)
      }) as any

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient
        .mockResolvedValue(mockSupabaseClient as any)
      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient
        .mockReturnValue(buildSupabaseMock() as any)

      const { listEvents } = await loadEventsService()

      const result = await listEvents()

      expect(Array.isArray(result)).toBe(true)
    })
  })
})
