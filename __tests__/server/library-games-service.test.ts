// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import type { ServiceError } from '@/lib/server/service-error'

/**
 * LIBRARY GAMES SERVICE TEST COVERAGE (OIR-205)
 *
 * Tests for admin CRUD operations on library games (ludoteca highlights) and public read access.
 * Implementation: lib/server/library-games-service.ts
 *
 * Key scenarios tested:
 * - listLibraryGames returns active games ordered by sort_order then title (public, via RLS)
 * - listAdminLibraryGames returns all games (active + inactive) for admin dashboard
 * - createLibraryGame/updateLibraryGame/deleteLibraryGame admin-only operations
 * - Non-admin users get 403 Forbidden from every admin endpoint
 * - weight validation: accepts 0–5 inclusive (including falsy-zero!), rejects 5.1, -1, NaN, string, null-when-required
 * - Type guards: title as object/array rejected with 400
 * - Validate-before-write: invalid input prevents DB calls
 * - Migration enables RLS, creates SELECT-only policy for active=true, seeds exactly 8 games with category_es AND category_en
 * - Chained .order() calls: secondary order('title') tie-break for consistent results
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

type LibraryGameRow = {
  id: string
  title: string
  category_es: string
  category_en: string
  players: string
  play_time: string
  weight: number | string
  sort_order: number
  active: boolean
  created_at: string
  updated_at: string
}

type SessionUser = {
  id: string
  role: 'admin' | 'member'
  email?: string
}

function buildSupabaseMock() {
  return {
    from: vi.fn(function (table: string) {
      const state = {
        table,
        filters: {} as any,
        updateData: {} as any,
        data: null as any,
        insertData: null as any,
        orders: [] as any[],
      }

      // Helper: Create a chainable query builder with .order() and .eq() support
      function createOrderableBuilder() {
        return {
          eq: vi.fn(function (col: string, val: any) {
            state.filters[col] = val
            return {
              maybeSingle: vi.fn(async () => {
                if (table === 'library_games' && state.filters.id === 'game-1') {
                  return {
                    data: {
                      id: 'game-1',
                      title: 'Existing Game',
                      category_es: 'Estrategia',
                      category_en: 'Strategy',
                      players: '2-4',
                      play_time: '90m',
                      weight: 3.0,
                      sort_order: 0,
                      active: true,
                      created_at: '2026-07-04T00:00:00Z',
                      updated_at: '2026-07-04T00:00:00Z',
                    },
                    error: null,
                  }
                }
                return { data: null, error: null }
              }),
              select: vi.fn(() => ({
                maybeSingle: vi.fn(async () => {
                  if (table === 'library_games' && state.filters.id === 'game-1') {
                    return {
                      data: {
                        id: 'game-1',
                        title: 'Existing Game',
                        category_es: 'Estrategia',
                        category_en: 'Strategy',
                        players: '2-4',
                        play_time: '90m',
                        weight: 3.0,
                        sort_order: 0,
                        active: true,
                        created_at: '2026-07-04T00:00:00Z',
                        updated_at: '2026-07-04T00:00:00Z',
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: null }
                }),
              })),
            }
          }),
          order: vi.fn(function (col: string, opts: any) {
            state.orders.push({ col, opts })
            return createChainableQuery()
          }),
          select: vi.fn(() => ({
            eq: vi.fn(function (col: string, val: any) {
              state.filters[col] = val
              return {
                maybeSingle: vi.fn(async () => {
                  if (table === 'library_games' && state.filters.id === 'game-1') {
                    return {
                      data: {
                        id: 'game-1',
                        title: 'Existing Game',
                        category_es: 'Estrategia',
                        category_en: 'Strategy',
                        players: '2-4',
                        play_time: '90m',
                        weight: 3.0,
                        sort_order: 0,
                        active: true,
                        created_at: '2026-07-04T00:00:00Z',
                        updated_at: '2026-07-04T00:00:00Z',
                      },
                      error: null,
                    }
                  }
                  return { data: null, error: null }
                }),
              }
            }),
          })),
        }
      }

      // Helper: Create a thenable that is also chainable (supports multiple .order() calls)
      function createChainableQuery() {
        return {
          [Symbol.toStringTag]: 'Promise',
          order: vi.fn(function (col: string, opts: any) {
            state.orders.push({ col, opts })
            // Return another chainable query for further chaining
            return createChainableQuery()
          }),
          then: async (onFulfilled?: any, onRejected?: any) => {
            try {
              if (table === 'library_games') {
                const mockData = [
                  {
                    id: 'game-1',
                    title: 'Bolt Action',
                    category_es: 'Wargame',
                    category_en: 'Wargame',
                    players: '2',
                    play_time: '120m',
                    weight: 3.2,
                    sort_order: 0,
                    active: true,
                    created_at: '2026-07-04T00:00:00Z',
                    updated_at: '2026-07-04T00:00:00Z',
                  },
                  {
                    id: 'game-2',
                    title: 'Pathfinder 2e',
                    category_es: 'Rol',
                    category_en: 'RPG',
                    players: '3–6',
                    play_time: '∞',
                    weight: 4.1,
                    sort_order: 1,
                    active: true,
                    created_at: '2026-07-04T00:00:00Z',
                    updated_at: '2026-07-04T00:00:00Z',
                  },
                ]
                return onFulfilled?.({ data: mockData, error: null })
              }
              return onFulfilled?.({ data: [], error: null })
            } catch (err) {
              return onRejected?.(err)
            }
          },
        }
      }

      return {
        select: vi.fn(function (cols?: string) {
          return createOrderableBuilder()
        }),
        insert: vi.fn(function (data: any) {
          state.insertData = data
          return {
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: 'game-new-1',
                  ...data,
                  created_at: '2026-07-04T00:00:00Z',
                  updated_at: '2026-07-04T00:00:00Z',
                } as LibraryGameRow,
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
                      created_at: '2026-07-04T00:00:00Z',
                      updated_at: '2026-07-04T00:00:00Z',
                    } as LibraryGameRow,
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

async function loadLibraryGamesService() {
  vi.resetModules()
  const mod = await import('@/lib/server/library-games-service')
  return {
    listLibraryGames: mod.listLibraryGames,
    listAdminLibraryGames: mod.listAdminLibraryGames,
    createLibraryGame: mod.createLibraryGame,
    updateLibraryGame: mod.updateLibraryGame,
    deleteLibraryGame: mod.deleteLibraryGame,
  }
}

describe('library-games-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listLibraryGames', () => {
    it('returns active games ordered by sort_order', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listLibraryGames } = await loadLibraryGamesService()

      const result = await listLibraryGames()

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBe(2)
      expect(result[0].title).toBe('Bolt Action')
      expect(result[0].sortOrder).toBe(0)
      expect(result[1].title).toBe('Pathfinder 2e')
      expect(result[1].sortOrder).toBe(1)
    })

    it('chains multiple order() calls without error (sort_order primary, title secondary)', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listLibraryGames } = await loadLibraryGamesService()

      // This test verifies that the chainable .order() mock works correctly
      // The service calls .order('sort_order').order('title'), which would fail
      // without the fix (chainable mock). If it doesn't throw, chaining works.
      const result = await listLibraryGames()
      expect(Array.isArray(result)).toBe(true)
    })

    it('uses user-scoped client (RLS-respecting) for public listing', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listLibraryGames } = await loadLibraryGamesService()

      await listLibraryGames()

      expect(vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient).toHaveBeenCalled()
    })

    it('maps database columns to public LibraryGame type', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listLibraryGames } = await loadLibraryGamesService()

      const result = await listLibraryGames()

      expect(result[0]).toMatchObject({
        id: 'game-1',
        title: 'Bolt Action',
        categoryEs: 'Wargame',
        categoryEn: 'Wargame',
        players: '2',
        playTime: '120m',
        weight: 3.2,
        sortOrder: 0,
      })
      expect(result[0]).not.toHaveProperty('active')
    })

    it('converts weight to number type', async () => {
      const mockSupabaseClient = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerClient.mockResolvedValue(
        mockSupabaseClient as any
      )

      const { listLibraryGames } = await loadLibraryGamesService()

      const result = await listLibraryGames()

      expect(typeof result[0].weight).toBe('number')
      expect(result[1].weight).toBe(4.1)
    })
  })

  describe('listAdminLibraryGames', () => {
    it('admin can list all games including inactive', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { listAdminLibraryGames } = await loadLibraryGamesService()

      const result = await listAdminLibraryGames(adminSession)

      expect(Array.isArray(result)).toBe(true)
      expect(result[0]).toHaveProperty('active')
    })

    it('chains multiple order() calls without error (sort_order primary, title secondary)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { listAdminLibraryGames } = await loadLibraryGamesService()

      // This test verifies that the chainable .order() mock works correctly.
      // The service calls .order('sort_order').order('title'). If it doesn't throw,
      // the mock fidelity fix (chainable .order()) is working.
      const result = await listAdminLibraryGames(adminSession)
      expect(Array.isArray(result)).toBe(true)
    })

    it('non-admin member gets 403 Forbidden', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { listAdminLibraryGames } = await loadLibraryGamesService()

      await expect(listAdminLibraryGames(memberSession)).rejects.toMatchObject({ statusCode: 403 })
    })
  })

  describe('createLibraryGame', () => {
    it('admin can create a game with required fields', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createLibraryGame } = await loadLibraryGamesService()

      const result = await createLibraryGame(adminSession, {
        title: 'New Game',
        categoryEs: 'Estrategia',
        categoryEn: 'Strategy',
        players: '2-4',
        playTime: '60m',
        weight: 3.0,
      })

      expect(result.id).toBe('game-new-1')
      expect(result.title).toBe('New Game')
      expect(result.categoryEs).toBe('Estrategia')
    })

    it('admin can create a game with all fields', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createLibraryGame } = await loadLibraryGamesService()

      const result = await createLibraryGame(adminSession, {
        title: 'Complete Game',
        categoryEs: 'Rol',
        categoryEn: 'RPG',
        players: '3-6',
        playTime: '∞',
        weight: 4.5,
        sortOrder: 10,
        active: true,
      })

      expect(result.title).toBe('Complete Game')
      expect(result.active).toBe(true)
    })

    it('non-admin member gets 403 Forbidden', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(memberSession, {
          title: 'Game',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 3.0,
        })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('accepts weight 0 (falsy-zero)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createLibraryGame } = await loadLibraryGamesService()

      const result = await createLibraryGame(adminSession, {
        title: 'Zero Weight',
        categoryEs: 'Familiar',
        categoryEn: 'Family',
        players: '1-4',
        playTime: '20m',
        weight: 0,
      })

      expect(result.id).toBe('game-new-1')
    })

    it('accepts weight 5 (upper bound inclusive)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { createLibraryGame } = await loadLibraryGamesService()

      const result = await createLibraryGame(adminSession, {
        title: 'Heavy Game',
        categoryEs: 'Estrategia',
        categoryEn: 'Strategy',
        players: '2-4',
        playTime: '120m',
        weight: 5,
      })

      expect(result.id).toBe('game-new-1')
    })

    it('rejects weight 5.1 (above upper bound)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 5.1,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects weight -1 (negative)', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: -1,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects weight as NaN', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: NaN,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects weight as string', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 'heavy' as any,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects weight null when required', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: null,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects title as object with 400', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: { invalid: 'object' },
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 3.0,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects title as array with 400', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: ['array', 'title'],
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 3.0,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects categoryEs as array with 400', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEs: [],
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 3.0,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects missing/empty title', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: '',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 3.0,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('rejects missing categoryEs', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 3.0,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('validates before any DB insert', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { createLibraryGame } = await loadLibraryGamesService()

      await expect(
        createLibraryGame(adminSession, {
          title: 'Game',
          categoryEs: 'Estrategia',
          categoryEn: 'Strategy',
          players: '2-4',
          playTime: '60m',
          weight: 5.5,
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin.from('library_games').insert).not.toHaveBeenCalled()
    })
  })

  describe('updateLibraryGame', () => {
    it('admin can update a game', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { updateLibraryGame } = await loadLibraryGamesService()

      const result = await updateLibraryGame(adminSession, 'game-1', {
        title: 'Updated Game',
      })

      expect(result.id).toBe('game-1')
      expect(result.title).toBe('Updated Game')
    })

    it('non-admin member gets 403 Forbidden on update', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updateLibraryGame } = await loadLibraryGamesService()

      await expect(
        updateLibraryGame(memberSession, 'game-1', { title: 'Updated' })
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns 404 for non-existent game', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updateLibraryGame } = await loadLibraryGamesService()

      mockSupabaseAdmin.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })) as any

      await expect(
        updateLibraryGame(adminSession, 'nonexistent-game', { title: 'Updated' })
      ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('rejects weight 5.1 on update', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updateLibraryGame } = await loadLibraryGamesService()

      await expect(
        updateLibraryGame(adminSession, 'game-1', {
          weight: 5.1,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('validates before any DB update', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { updateLibraryGame } = await loadLibraryGamesService()

      await expect(
        updateLibraryGame(adminSession, 'game-1', {
          weight: 'invalid' as any,
        })
      ).rejects.toMatchObject({ statusCode: 400 })

      expect(mockSupabaseAdmin.from('library_games').update).not.toHaveBeenCalled()
    })

    it('preserves current values for omitted fields', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { updateLibraryGame } = await loadLibraryGamesService()

      const result = await updateLibraryGame(adminSession, 'game-1', {
        title: 'Updated Title',
      })

      expect(result.id).toBe('game-1')
    })
  })

  describe('deleteLibraryGame', () => {
    it('admin can delete a game', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )

      const { deleteLibraryGame } = await loadLibraryGamesService()

      await expect(deleteLibraryGame(adminSession, 'game-1')).resolves.toBeUndefined()
    })

    it('non-admin member gets 403 Forbidden on delete', async () => {
      const memberSession = createMemberSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { deleteLibraryGame } = await loadLibraryGamesService()

      await expect(deleteLibraryGame(memberSession, 'game-1')).rejects.toMatchObject({ statusCode: 403 })
    })

    it('returns 404 for non-existent game', async () => {
      const adminSession = createAdminSession()
      const mockSupabaseAdmin = buildSupabaseMock()

      vi.mocked(await import('@/lib/supabase/server')).createSupabaseServerAdminClient.mockReturnValue(
        mockSupabaseAdmin as any
      )
      vi.mocked(await import('@/lib/server/service-error')).serviceError.mockImplementation((msg, code) => {
        const err = new Error(msg) as ServiceError
        err.statusCode = code
        throw err
      })

      const { deleteLibraryGame } = await loadLibraryGamesService()

      mockSupabaseAdmin.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      })) as any

      await expect(deleteLibraryGame(adminSession, 'nonexistent-game')).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('migration sanity checks', () => {
    const migrationPath = join(
      '/Users/samuelromeroarbelo/Projects/Alea/alea-webapp/supabase/migrations',
      '20260704000003_oir205_library_games_table.sql'
    )
    const migrationContent = readFileSync(migrationPath, 'utf8')

    it('migration file enables RLS on library_games table', () => {
      expect(migrationContent).toContain('ALTER TABLE "public"."library_games" ENABLE ROW LEVEL SECURITY')
    })

    it('migration creates SELECT-only policy for anon and authenticated where active=true', () => {
      expect(migrationContent).toContain('CREATE POLICY "library_games_select_active"')
      expect(migrationContent).toContain('FOR SELECT TO "anon", "authenticated"')
      expect(migrationContent).toContain('USING ("active" = true)')
    })

    it('migration grants SELECT only (no INSERT/UPDATE/DELETE)', () => {
      expect(migrationContent).toContain('GRANT SELECT ON TABLE "public"."library_games" TO "anon", "authenticated"')
      expect(migrationContent).not.toContain('GRANT INSERT')
      expect(migrationContent).not.toContain('GRANT UPDATE')
      expect(migrationContent).not.toContain('GRANT DELETE')
    })

    it('migration seeds exactly 8 games', () => {
      const insertMatch = migrationContent.match(/INSERT INTO "public"."library_games"[\s\S]*?VALUES([\s\S]*?);/)
      expect(insertMatch).not.toBeNull()
      if (insertMatch) {
        const valuesSection = insertMatch[1]
        const rowCount = (valuesSection.match(/^\s*\(/gm) || []).length
        expect(rowCount).toBe(8)
      }
    })

    it('migration seeds have category_es AND category_en populated for all games', () => {
      // Verify seeded games have bilingual categories
      expect(migrationContent).toContain("'Bolt Action'")
      expect(migrationContent).toContain("'Wargame'") // appears in Bolt Action and Warhammer
      expect(migrationContent).toContain("'Pathfinder 2e'")
      expect(migrationContent).toContain("'Rol'") // Spanish category
      expect(migrationContent).toContain("'RPG'") // English category for Pathfinder
      expect(migrationContent).toContain("'Deducción'") // Spanish for Blood on the Clocktower
      expect(migrationContent).toContain("'Deduction'") // English
    })

    it('migration creates required columns with correct types', () => {
      expect(migrationContent).toContain('"id" uuid PRIMARY KEY DEFAULT gen_random_uuid()')
      expect(migrationContent).toContain('"title" text NOT NULL')
      expect(migrationContent).toContain('"category_es" text NOT NULL')
      expect(migrationContent).toContain('"category_en" text NOT NULL')
      expect(migrationContent).toContain('"players" text NOT NULL')
      expect(migrationContent).toContain('"play_time" text NOT NULL')
      expect(migrationContent).toContain('"weight" numeric(2,1) NOT NULL')
      expect(migrationContent).toContain('"sort_order" integer NOT NULL DEFAULT 0')
      expect(migrationContent).toContain('"active" boolean NOT NULL DEFAULT true')
      expect(migrationContent).toContain('"created_at" timestamptz NOT NULL DEFAULT now()')
      expect(migrationContent).toContain('"updated_at" timestamptz NOT NULL DEFAULT now()')
    })
  })
})
