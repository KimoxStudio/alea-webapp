// @vitest-environment node
import { vi } from 'vitest'

/**
 * Reusable Supabase mock factory for service tests.
 *
 * Provides helpers to build realistic Supabase client mocks that match
 * the chainable query patterns used across service tests.
 *
 * Instead of hand-rolling per-test, tests can use:
 * - createQueryBuilder(source) → chainable from().select().eq().maybeSingle()
 * - Shared state management for table data
 */

type MockData = Record<string, unknown>

/**
 * Create a chainable query builder for a data source.
 *
 * Supports filtering (.eq, .lt, .lte, .gt, .gte) and result methods
 * (.maybeSingle, .single, .limit, awaitable as array).
 *
 * Usage:
 * ```
 * const data = [
 *   { id: 'user-1', name: 'Alice', role: 'admin' },
 *   { id: 'user-2', name: 'Bob', role: 'member' },
 * ]
 * const query = createQueryBuilder(data)
 *   .eq('role', 'admin')
 *
 * const result = await query.maybeSingle()
 * // { data: { id: 'user-1', name: 'Alice', role: 'admin' }, error: null }
 * ```
 */
export function createQueryBuilder<T extends MockData = MockData>(source: T[]) {
  let rows = [...source]
  const filters: Array<{
    column: string
    value: unknown
    operator: 'eq' | 'lt' | 'lte' | 'gt' | 'gte' | 'neq'
  }> = []

  function applyFilters() {
    return rows.filter((row) =>
      filters.every(({ column, value, operator }) => {
        const rowValue = row[column]
        switch (operator) {
          case 'eq':
            return String(rowValue) === String(value)
          case 'lt':
            return String(rowValue) < String(value)
          case 'lte':
            return String(rowValue) <= String(value)
          case 'gt':
            return String(rowValue) > String(value)
          case 'gte':
            return String(rowValue) >= String(value)
          case 'neq':
            return String(rowValue) !== String(value)
          default:
            return true
        }
      }),
    )
  }

  function chainedBuilder() {
    return {
      eq: (column: string, value: unknown) => {
        filters.push({ column, value, operator: 'eq' })
        return chainedBuilder()
      },
      lt: (column: string, value: unknown) => {
        filters.push({ column, value, operator: 'lt' })
        return chainedBuilder()
      },
      lte: (column: string, value: unknown) => {
        filters.push({ column, value, operator: 'lte' })
        return chainedBuilder()
      },
      gt: (column: string, value: unknown) => {
        filters.push({ column, value, operator: 'gt' })
        return chainedBuilder()
      },
      gte: (column: string, value: unknown) => {
        filters.push({ column, value, operator: 'gte' })
        return chainedBuilder()
      },
      neq: (column: string, value: unknown) => {
        filters.push({ column, value, operator: 'neq' })
        return chainedBuilder()
      },
      order: (column?: string, options?: { ascending?: boolean }) => chainedBuilder(),
      limit: (count: number) =>
        Promise.resolve({ data: applyFilters().slice(0, count), error: null }),
      maybeSingle: () =>
        Promise.resolve({ data: applyFilters()[0] ?? null, error: null }),
      single: () => {
        const results = applyFilters()
        if (results.length === 0) {
          return Promise.resolve({ data: null, error: { message: 'No rows found' } })
        }
        return Promise.resolve({ data: results[0], error: null })
      },
      then: <TResult = unknown>(
        resolve?: (value: { data: T[]; error: null }) => TResult | PromiseLike<TResult>,
      ) => {
        return Promise.resolve({ data: applyFilters(), error: null }).then(resolve)
      },
    }
  }

  return chainedBuilder()
}

/**
 * Create an in-memory state store for managing table data across test calls.
 *
 * Each table gets its own array. Tests can push/filter/modify the arrays
 * and the mock will reflect those changes on next query.
 *
 * Usage:
 * ```
 * const store = createTableStateStore()
 * store.users.push({ id: 'user-1', name: 'Alice' })
 *
 * const query = createQueryBuilder(store.users)
 * const result = await query.eq('id', 'user-1').maybeSingle()
 * ```
 */
export function createTableStateStore() {
  return {
    tables: [] as MockData[],
    saved_games: [] as MockData[],
    event_room_blocks: [] as MockData[],
    saved_game_attendances: [] as MockData[],
    profiles: [] as MockData[],
    activation_tokens: [] as MockData[],
    reservations: [] as MockData[],
    rooms: [] as MockData[],
    equipment: [] as MockData[],
  }
}

/**
 * Helper to create a mocked Supabase module for use with vi.mock().
 *
 * Handles the common pattern of exposing createSupabaseServerAdminClient
 * that returns a client with a from() method that routes to table stores.
 *
 * For complex per-table logic (custom insert/update behavior, conditional errors),
 * provide a tableRouter function that maps table names to custom handlers.
 *
 * Usage:
 * ```
 * const store = createTableStateStore()
 * const factory = createSupabaseModuleMock(store, (table, store) => {
 *   if (table === 'saved_games') {
 *     return {
 *       select: () => createQueryBuilder(store.saved_games),
 *       insert: (values) => ({ ... custom logic ... }),
 *     }
 *   }
 *   // Default: simple query builder
 *   return { select: () => createQueryBuilder(store[table]) }
 * })
 *
 * vi.mock('@/lib/supabase/server', () => factory)
 * ```
 */
export function createSupabaseModuleMock(
  store: ReturnType<typeof createTableStateStore>,
  tableRouter?: (
    table: string,
    store: ReturnType<typeof createTableStateStore>,
  ) => Record<string, any>,
) {
  return {
    createSupabaseServerAdminClient: () => ({
      from: (table: string) => {
        if (tableRouter) {
          return tableRouter(table, store)
        }
        // Default: return simple query builder for any table
        const tableData = store[table as keyof typeof store] ?? []
        return {
          select: () => createQueryBuilder(tableData),
        }
      },
    }),
    createSupabaseServerClient: vi.fn(async () => ({
      from: (table: string) => {
        if (tableRouter) {
          return tableRouter(table, store)
        }
        const tableData = store[table as keyof typeof store] ?? []
        return {
          select: () => createQueryBuilder(tableData),
        }
      },
    })),
    createSupabaseRouteHandlerClient: () => ({
      supabase: {
        from: (table: string) => {
          if (tableRouter) {
            return tableRouter(table, store)
          }
          const tableData = store[table as keyof typeof store] ?? []
          return {
            select: () => createQueryBuilder(tableData),
          }
        },
      },
      applyCookies: (res: any) => res,
    }),
  }
}
