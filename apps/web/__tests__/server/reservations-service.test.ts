import type { SessionUser } from '@/lib/server/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type ReservationRow = {
  id: string
  table_id: string
  user_id: string
  date: string
  start_time: string
  end_time: string
  status: 'active' | 'cancelled' | 'completed'
  surface: 'top' | 'bottom' | null
  created_at: string
}

type TableRow = {
  id: string
  room_id: string
  name: string
  type: 'small' | 'large' | 'removable_top'
  qr_code: string | null
  pos_x: number | null
  pos_y: number | null
}

const adminSession: SessionUser = {
  id: '1',
  role: 'admin',
}

const memberSession: SessionUser = {
  id: '2',
  role: 'member',
}

const reservationsState: ReservationRow[] = []
const tablesState = new Map<string, TableRow>()

function makeReservation(overrides?: Partial<ReservationRow>): ReservationRow {
  return {
    id: 'r1',
    table_id: 't1',
    user_id: '2',
    date: '2026-04-04',
    start_time: '16:00:00',
    end_time: '18:00:00',
    status: 'active',
    surface: null,
    created_at: '2026-04-04T10:00:00.000Z',
    ...overrides,
  }
}

function cloneReservation(row: ReservationRow) {
  return { ...row }
}

function seedState() {
  reservationsState.length = 0
  reservationsState.push(
    makeReservation(),
    makeReservation({
      id: 'r2',
      table_id: 't3',
      start_time: '10:00:00',
      end_time: '12:00:00',
      surface: 'top',
    }),
  )

  tablesState.clear()
  tablesState.set('t1', {
    id: 't1',
    room_id: 'room-1',
    name: 'Mesa 1',
    type: 'large',
    qr_code: 'QR-1',
    pos_x: 0,
    pos_y: 0,
  })
  tablesState.set('t3', {
    id: 't3',
    room_id: 'room-1',
    name: 'Mesa 3',
    type: 'removable_top',
    qr_code: 'QR-3',
    pos_x: 1,
    pos_y: 0,
  })
}

function buildSelectChain<T>(rows: T[]) {
  let current = [...rows]

  return {
    eq(column: string, value: string) {
      current = current.filter((row) => String((row as Record<string, unknown>)[column]) === value)
      return this
    },
    neq(column: string, value: string) {
      current = current.filter((row) => String((row as Record<string, unknown>)[column]) !== value)
      return this
    },
    order(column: string, { ascending }: { ascending: boolean }) {
      current = [...current].sort((left, right) => {
        const a = String((left as Record<string, unknown>)[column] ?? '')
        const b = String((right as Record<string, unknown>)[column] ?? '')
        return ascending ? a.localeCompare(b) : b.localeCompare(a)
      })
      return this
    },
    then<TResult1 = { data: T[]; error: null }, TResult2 = never>(
      onfulfilled?: ((value: { data: T[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
    ) {
      return Promise.resolve({ data: current.map((row) => ({ ...row })), error: null }).then(onfulfilled, onrejected)
    },
    maybeSingle() {
      return Promise.resolve({ data: current[0] ? { ...current[0] } : null, error: null })
    },
    single() {
      return Promise.resolve({ data: current[0] ? { ...current[0] } : null, error: null })
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'tables') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((column: string, value: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: column === 'id' ? (tablesState.get(value) ?? null) : null,
                error: null,
              })),
            })),
          })),
        }
      }

      if (table === 'reservations') {
        return {
          select: vi.fn(() => buildSelectChain(reservationsState)),
          insert: vi.fn((payload: Record<string, string | null>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const row = makeReservation({
                  id: `r${reservationsState.length + 1}`,
                  table_id: String(payload.table_id),
                  user_id: String(payload.user_id),
                  date: String(payload.date),
                  start_time: `${String(payload.start_time)}:00`,
                  end_time: `${String(payload.end_time)}:00`,
                  surface: payload.surface as ReservationRow['surface'],
                  created_at: '2026-04-04T12:00:00.000Z',
                })
                reservationsState.push(row)
                return { data: cloneReservation(row), error: null }
              }),
            })),
          })),
          update: vi.fn((payload: Record<string, string | null>) => ({
            eq: vi.fn((column: string, value: string) => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  const row = reservationsState.find((reservation) => String((reservation as Record<string, unknown>)[column]) === value)
                  if (!row) {
                    return { data: null, error: null }
                  }

                  Object.assign(row, payload)
                  if (payload.start_time) row.start_time = `${payload.start_time}:00`
                  if (payload.end_time) row.end_time = `${payload.end_time}:00`
                  return { data: cloneReservation(row), error: null }
                }),
              })),
            })),
          })),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    }),
  })),
  createSupabaseServerAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table !== 'reservations') {
        throw new Error(`Unexpected admin table ${table}`)
      }

      return {
        select: vi.fn(() => buildSelectChain(reservationsState)),
      }
    }),
  })),
}))

async function loadReservationModules() {
  vi.resetModules()
  const service = await import('@/lib/server/reservations-service')
  return { ...service }
}

describe('reservations service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seedState()
  })

  describe('listVisibleReservations', () => {
    it('ignores userId filters for members and returns only the caller reservations', async () => {
      const { listVisibleReservations } = await loadReservationModules()

      const result = await listVisibleReservations({
        session: memberSession,
        userId: '999',
      })

      expect(result).toHaveLength(2)
      expect(result.every((reservation) => reservation.userId === '2')).toBe(true)
    })
  })

  describe('createReservationForSession', () => {
    it('requires a surface for removable-top tables', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't3',
        date: '2026-04-05',
        startTime: '12:00',
        endTime: '13:00',
      })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
      })
    })

    it('maps conflicting slots to a 409 service error', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-04-04',
        startTime: '17:00',
        endTime: '18:30',
      })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 409,
      })
    })
  })

  describe('updateReservationForSession', () => {
    it('treats null status as absent', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', { status: null })

      expect(updated.status).toBe('active')
    })

    it('treats null date and times as absent while applying explicit updates', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', {
        date: null,
        startTime: null,
        endTime: null,
        status: null,
        surface: null,
      })

      expect(updated.date).toBe('2026-04-04')
      expect(updated.startTime).toBe('16:00')
      expect(updated.endTime).toBe('18:00')
      expect(updated.status).toBe('active')
    })

    it('updates explicitly provided non-null fields', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', {
        status: null,
        startTime: '18:00',
        endTime: '19:00',
      })

      expect(updated.status).toBe('active')
      expect(updated.startTime).toBe('18:00')
      expect(updated.endTime).toBe('19:00')
    })

    it('surface stays null when body.surface is null', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', { surface: null })

      expect(updated.surface).toBeNull()
    })

    it('surface stays null when body.surface is undefined', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', { surface: undefined })

      expect(updated.surface).toBeNull()
    })
  })

  describe('checkReservationAccess', () => {
    it('throws 404 when reservation is not found', async () => {
      const { checkReservationAccess } = await loadReservationModules()

      await expect(checkReservationAccess(memberSession, 'missing')).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 404,
      })
    })

    it('throws 403 when a member accesses another user reservation', async () => {
      const { checkReservationAccess } = await loadReservationModules()

      await expect(checkReservationAccess({ id: '999', role: 'member' }, 'r1')).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 403,
      })
    })

    it('allows owners and admins to access the reservation', async () => {
      const { checkReservationAccess } = await loadReservationModules()

      await expect(checkReservationAccess(memberSession, 'r1')).resolves.toBeUndefined()
      await expect(checkReservationAccess(adminSession, 'r1')).resolves.toBeUndefined()
    })
  })
})
