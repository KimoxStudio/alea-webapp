// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionUser } from '@/lib/server/auth'

type SavedGameRow = {
  id: string
  table_id: string
  user_id: string
  start_date: string
  end_date: string
  status: string
  attendance_count: number
  renewed_from_id: string | null
  created_at: string
  updated_at: string
  tables?: { name: string; rooms: { name: string } }
}

const state = vi.hoisted(() => ({
  tables: new Map<string, { id: string; room_id: string; type: string; name: string }>(),
  blocks: [] as Array<{ id: string; room_id: string; date: string }>,
  savedGames: [] as SavedGameRow[],
  attendances: [] as Array<{ saved_game_id: string; play_reservation_id: string; attended_on: string }>,
}))

vi.mock('@/lib/club-time', async () => {
  const actual = await vi.importActual<typeof import('@/lib/club-time')>('@/lib/club-time')
  return { ...actual, getCurrentClubDate: () => '2026-06-19' }
})

function query<T extends Record<string, unknown>>(source: T[]) {
  let rows = [...source]
  const chain = {
    eq(column: string, value: string) { rows = rows.filter((row) => String(row[column]) === value); return chain },
    lt(column: string, value: string) { rows = rows.filter((row) => String(row[column]) < value); return chain },
    lte(column: string, value: string) { rows = rows.filter((row) => String(row[column]) <= value); return chain },
    gte(column: string, value: string) { rows = rows.filter((row) => String(row[column]) >= value); return chain },
    order() { return chain },
    limit(count: number) { return Promise.resolve({ data: rows.slice(0, count), error: null }) },
    maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }) },
    then<TResult1 = { data: T[]; error: null }>(resolve?: (value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) {
      return Promise.resolve({ data: rows, error: null }).then(resolve)
    },
  }
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient: () => ({
    from: (table: string) => {
      if (table === 'tables') {
        return { select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: async () => ({ data: state.tables.get(id) ?? null, error: null }) }) }) }
      }
      if (table === 'event_room_blocks') return { select: () => query(state.blocks) }
      if (table === 'saved_game_attendances') {
        return {
          insert: async (row: { saved_game_id: string; play_reservation_id: string; attended_on: string }) => {
            if (state.attendances.some((item) => item.play_reservation_id === row.play_reservation_id)) return { error: { code: '23505' } }
            state.attendances.push(row)
            return { error: null }
          },
        }
      }
      if (table !== 'saved_games') throw new Error(`Unexpected table ${table}`)
      return {
        select: () => query(state.savedGames),
        update: (values: Partial<SavedGameRow>) => {
          const filters: Array<[string, string, 'eq' | 'lt']> = []
          const updateChain = {
            eq(column: string, value: string) { filters.push([column, value, 'eq']); return updateChain },
            lt(column: string, value: string) {
              filters.push([column, value, 'lt'])
              state.savedGames.filter((row) => filters.every(([key, expected, op]) => op === 'eq' ? String(row[key as keyof SavedGameRow]) === expected : String(row[key as keyof SavedGameRow]) < expected)).forEach((row) => Object.assign(row, values))
              return Promise.resolve({ error: null })
            },
          }
          return updateChain
        },
        insert: (values: Partial<SavedGameRow>) => ({
          select: () => ({
            single: async () => {
              const overlap = state.savedGames.some((row) => row.table_id === values.table_id && row.status === 'active' && row.start_date <= String(values.end_date) && row.end_date >= String(values.start_date))
              if (overlap) return { data: null, error: { code: '23P01' } }
              const tableRow = state.tables.get(String(values.table_id))!
              const row: SavedGameRow = {
                id: `sg-${state.savedGames.length + 1}`,
                table_id: String(values.table_id), user_id: String(values.user_id),
                start_date: String(values.start_date), end_date: String(values.end_date),
                status: 'active', attendance_count: 0,
                renewed_from_id: values.renewed_from_id ? String(values.renewed_from_id) : null,
                created_at: '2026-06-19T10:00:00Z', updated_at: '2026-06-19T10:00:00Z',
                tables: { name: tableRow.name, rooms: { name: 'Sala' } },
              }
              state.savedGames.push(row)
              return { data: row, error: null }
            },
          }),
        }),
      }
    },
  }),
}))

const member: SessionUser = { id: 'user-1', role: 'member' }

describe('saved games service', () => {
  beforeEach(() => {
    state.tables.clear()
    state.tables.set('double', { id: 'double', room_id: 'room-1', type: 'removable_top', name: 'Mesa doble' })
    state.tables.set('regular', { id: 'regular', room_id: 'room-1', type: 'large', name: 'Mesa normal' })
    state.blocks.length = 0
    state.savedGames.length = 0
    state.attendances.length = 0
  })

  it('creates a day-based Saved Game on a removable-top table', async () => {
    const { createSavedGameForSession } = await import('@/lib/server/saved-games-service')
    const result = await createSavedGameForSession(member, { tableId: 'double', startDate: '2026-06-20', endDate: '2026-09-19' })
    expect(result).toMatchObject({ tableId: 'double', startDate: '2026-06-20', endDate: '2026-09-19', attendanceCount: 0 })
  })

  it('rejects regular tables and durations over three months', async () => {
    const { createSavedGameForSession } = await import('@/lib/server/saved-games-service')
    await expect(createSavedGameForSession(member, { tableId: 'regular', startDate: '2026-06-20', endDate: '2026-07-20' })).rejects.toMatchObject({ message: 'SAVED_GAME_REQUIRES_REMOVABLE_TOP' })
    await expect(createSavedGameForSession(member, { tableId: 'double', startDate: '2026-06-20', endDate: '2026-09-20' })).rejects.toMatchObject({ message: 'SAVED_GAME_MAX_DURATION' })
  })

  it('rejects date ranges blocked by an event', async () => {
    state.blocks.push({ id: 'event-1', room_id: 'room-1', date: '2026-07-01' })
    const { createSavedGameForSession } = await import('@/lib/server/saved-games-service')
    await expect(createSavedGameForSession(member, { tableId: 'double', startDate: '2026-06-20', endDate: '2026-07-20' })).rejects.toMatchObject({ message: 'SAVED_GAME_EVENT_CONFLICT', statusCode: 409 })
  })

  it('allows renewal only during the final fifteen days and creates the next period', async () => {
    state.savedGames.push({ id: 'sg-1', table_id: 'double', user_id: 'user-1', start_date: '2026-04-01', end_date: '2026-06-30', status: 'active', attendance_count: 2, renewed_from_id: null, created_at: '', updated_at: '' })
    const { renewSavedGameForSession } = await import('@/lib/server/saved-games-service')
    const renewed = await renewSavedGameForSession(member, 'sg-1')
    expect(renewed).toMatchObject({ startDate: '2026-07-01', endDate: '2026-09-30', renewedFromId: 'sg-1' })
  })

  it('rejects renewal before the final fifteen days', async () => {
    state.savedGames.push({ id: 'sg-1', table_id: 'double', user_id: 'user-1', start_date: '2026-06-01', end_date: '2026-08-31', status: 'active', attendance_count: 0, renewed_from_id: null, created_at: '', updated_at: '' })
    const { renewSavedGameForSession } = await import('@/lib/server/saved-games-service')
    await expect(renewSavedGameForSession(member, 'sg-1')).rejects.toMatchObject({ message: 'SAVED_GAME_RENEWAL_NOT_OPEN' })
  })

  it('records QR attendance only for the user top reservation and remains idempotent', async () => {
    state.savedGames.push({ id: 'sg-1', table_id: 'double', user_id: 'user-1', start_date: '2026-06-01', end_date: '2026-08-31', status: 'active', attendance_count: 0, renewed_from_id: null, created_at: '', updated_at: '' })
    const { recordSavedGameAttendance } = await import('@/lib/server/saved-games-service')
    const reservation = { id: 'r-1', table_id: 'double', user_id: 'user-1', date: '2026-06-19', start_time: '18:00', end_time: '20:00', surface: 'top' as const, status: 'active' as const, activated_at: '', created_at: '' }
    await recordSavedGameAttendance(reservation)
    await recordSavedGameAttendance(reservation)
    expect(state.attendances).toEqual([{ saved_game_id: 'sg-1', play_reservation_id: 'r-1', attended_on: '2026-06-19' }])
  })
})
