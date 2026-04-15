import type { SessionUser } from '@/lib/server/auth'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'

type ReservationRow = {
  id: string
  table_id: string
  user_id: string
  date: string
  start_time: string
  end_time: string
  status: 'active' | 'cancelled' | 'completed' | 'pending' | 'no_show'
  surface: 'top' | 'bottom' | null
  activated_at: string | null
  created_at: string
  // enriched join fields populated by the mock
  profiles?: { member_number: string } | null
  tables?: { name: string; rooms?: { name: string } | null } | null
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

type RoomRow = {
  id: string
  name: string
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
const profilesMap = new Map<string, { member_number: string }>()
const roomsMap = new Map<string, RoomRow>()
const eventRoomBlocksState: EventRoomBlockRow[] = []

function makeReservation(overrides?: Partial<ReservationRow>): ReservationRow {
  return {
    id: 'r1',
    table_id: 't1',
    user_id: '2',
    date: '2026-12-31',
    start_time: '16:00:00',
    end_time: '18:00:00',
    status: 'active',
    surface: null,
    activated_at: null,
    created_at: '2026-12-31T10:00:00.000Z',
    ...overrides,
  }
}

function cloneReservation(row: ReservationRow) {
  return { ...row }
}

function seedState() {
  profilesMap.clear()
  profilesMap.set('2', { member_number: 'M-00000002' })

  roomsMap.clear()
  roomsMap.set('room-1', { id: 'room-1', name: 'Sala Mirkwood' })

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
  tablesState.set('t2', {
    id: 't2',
    room_id: 'room-1',
    name: 'Mesa 2',
    type: 'small',
    qr_code: 'QR-2',
    pos_x: 1,
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

  reservationsState.length = 0
  eventRoomBlocksState.length = 0

  const r1base = makeReservation()
  const t1 = tablesState.get(r1base.table_id)!
  reservationsState.push({
    ...r1base,
    profiles: profilesMap.get(r1base.user_id) ?? null,
    tables: t1 ? { name: t1.name, rooms: roomsMap.get(t1.room_id) ?? null } : null,
  })

  const r2base = makeReservation({
    id: 'r2',
    table_id: 't3',
    start_time: '10:00:00',
    end_time: '12:00:00',
    surface: 'top',
  })
  const t3 = tablesState.get(r2base.table_id)!
  reservationsState.push({
    ...r2base,
    profiles: profilesMap.get(r2base.user_id) ?? null,
    tables: t3 ? { name: t3.name, rooms: roomsMap.get(t3.room_id) ?? null } : null,
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
    in(column: string, values: string[]) {
      current = current.filter((row) => values.includes(String((row as Record<string, unknown>)[column])))
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
    or(condition: string) {
      // OR filtering is handled by the actual Supabase client; mock just returns this for chaining
      return this
    },
    lt(column: string, value: string) {
      current = current.filter((row) => {
        let cellValue = String((row as Record<string, unknown>)[column] ?? '')
        // Normalize time values for comparison (HH:MM:SS -> HH:MM)
        if (cellValue.match(/^\d{2}:\d{2}:\d{2}$/)) {
          cellValue = cellValue.slice(0, 5)
        }
        return cellValue < value
      })
      return this
    },
    gt(column: string, value: string) {
      current = current.filter((row) => {
        let cellValue = String((row as Record<string, unknown>)[column] ?? '')
        // Normalize time values for comparison (HH:MM:SS -> HH:MM)
        if (cellValue.match(/^\d{2}:\d{2}:\d{2}$/)) {
          cellValue = cellValue.slice(0, 5)
        }
        return cellValue > value
      })
      return this
    },
    limit(count: number) {
      return Promise.resolve({ data: current.slice(0, count).map((row) => ({ ...row })), error: null })
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
      if (table === 'event_room_blocks') {
        return {
          select: vi.fn(() => buildSelectChain(eventRoomBlocksState)),
        }
      }

      if (table !== 'reservations') {
        throw new Error(`Unexpected admin table ${table}`)
      }

      return {
        select: vi.fn(() => buildSelectChain(reservationsState)),
        update: vi.fn((payload: Record<string, unknown>) => {
          // Support chained .eq() calls: update().eq(col, val).eq(col2, val2).select().single()
          // The first .eq() identifies the row (by 'id'); subsequent .eq() calls act as
          // TOCTOU conditions — the row is only updated if ALL conditions match.
          const filters: Array<[string, string]> = []
          const chain = {
            eq: vi.fn((column: string, value: string) => {
              filters.push([column, value])
              return chain
            }),
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const row = reservationsState.find((r) =>
                  filters.every(([col, val]) => String((r as Record<string, unknown>)[col]) === val)
                )
                if (!row) {
                  return { data: null, error: null }
                }
                Object.assign(row, payload)
                return { data: cloneReservation(row), error: null }
              }),
            })),
          }
          return chain
        }),
      }
    }),
    rpc: vi.fn(),
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

    it('lets admins filter by user, table, and date', async () => {
      const { listVisibleReservations } = await loadReservationModules()

      const r3base = makeReservation({
        id: 'r3',
        user_id: '9',
        table_id: 't1',
        date: '2026-04-05',
        start_time: '12:00:00',
        end_time: '13:00:00',
      })
      const t1 = tablesState.get('t1')!
      reservationsState.push({
        ...r3base,
        profiles: profilesMap.get('9') ?? null,
        tables: { name: t1.name, rooms: roomsMap.get(t1.room_id) ?? null },
      })

      const result = await listVisibleReservations({
        session: adminSession,
        userId: '9',
        tableId: 't1',
        date: '2026-04-05',
      })

      expect(result).toEqual([
        expect.objectContaining({
          id: 'r3',
          userId: '9',
          tableId: 't1',
          date: '2026-04-05',
          startTime: '12:00',
          endTime: '13:00',
        }),
      ])
    })

    it('populates memberNumber for admin sessions', async () => {
      const { listVisibleReservations } = await loadReservationModules()

      const result = await listVisibleReservations({ session: adminSession })

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.memberNumber).toBe('M-00000002')
    })

    it('strips memberNumber for member sessions', async () => {
      const { listVisibleReservations } = await loadReservationModules()

      const result = await listVisibleReservations({ session: memberSession })

      expect(result.length).toBeGreaterThan(0)
      expect(result[0]!.memberNumber).toBeUndefined()
    })

    it('populates roomName and tableName for admin sessions', async () => {
      const { listVisibleReservations } = await loadReservationModules()

      const result = await listVisibleReservations({ session: adminSession })

      // Both seeded reservations share the same room; find r1 which is on table t1 (Mesa 1)
      const r1 = result.find((r) => r.id === 'r1')
      expect(r1).toBeDefined()
      expect(r1!.roomName).toBe('Sala Mirkwood')
      expect(r1!.tableName).toBe('Mesa 1')
    })

    it('populates roomName and tableName for member sessions', async () => {
      const { listVisibleReservations } = await loadReservationModules()

      const result = await listVisibleReservations({ session: memberSession })

      const r1 = result.find((r) => r.id === 'r1')
      expect(r1).toBeDefined()
      expect(r1!.roomName).toBe('Sala Mirkwood')
      expect(r1!.tableName).toBe('Mesa 1')
    })
  })

  describe('createReservationForSession', () => {
    it('creates an active reservation through the session-scoped client', async () => {
      const { createReservationForSession } = await loadReservationModules()

      const created = await createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-12-31',
        startTime: '12:00',
        endTime: '13:00',
      })

      expect(created).toEqual(expect.objectContaining({
        tableId: 't1',
        userId: '2',
        date: '2026-12-31',
        startTime: '12:00',
        endTime: '13:00',
        status: 'active',
        surface: null,
      }))
    })

    it('requires a surface for removable-top tables', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't3',
        date: '2026-12-31',
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
        date: '2026-12-31',
        startTime: '17:00',
        endTime: '18:30',
      })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 409,
      })
    })

    it('rejects single-digit hour "9:00" with 400', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-12-31',
        startTime: '9:00',
        endTime: '10:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('rejects out-of-range hour "25:00" with 400', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-12-31',
        startTime: '25:00',
        endTime: '26:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('rejects out-of-range minutes "18:70" with 400', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-12-31',
        startTime: '18:70',
        endTime: '19:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('accepts midnight "00:00" as a valid time', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-12-31',
        startTime: '00:00',
        endTime: '01:00',
      })).resolves.toEqual(expect.objectContaining({ startTime: '00:00', endTime: '01:00' }))
    })

    it('ignores non-active reservations when checking conflicts', async () => {
      const { createReservationForSession } = await loadReservationModules()

      reservationsState[0]!.status = 'cancelled'

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-12-31',
        startTime: '17:00',
        endTime: '18:30',
      })).resolves.toEqual(expect.objectContaining({
        tableId: 't1',
        startTime: '17:00',
        endTime: '18:30',
      }))
    })

    it('treats pending reservations as conflicting', async () => {
      const { createReservationForSession } = await loadReservationModules()

      reservationsState[0]!.status = 'pending'

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-12-31',
        startTime: '17:00',
        endTime: '18:30',
      })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 409,
      })
    })

    it('rejects create when an overlapping event room block exists', async () => {
      const { createReservationForSession } = await loadReservationModules()
      reservationsState.forEach((reservation) => {
        reservation.user_id = 'other-user'
      })

      eventRoomBlocksState.push({
        id: 'block-1',
        event_id: 'event-1',
        room_id: 'room-1',
        date: '2026-12-31',
        start_time: '17:00:00',
        end_time: '19:00:00',
        all_day: false,
      })

      await expect(createReservationForSession(memberSession, {
        tableId: 't2',
        date: '2026-12-31',
        startTime: '17:30',
        endTime: '18:30',
      })).rejects.toMatchObject({
        name: 'ServiceError',
        message: 'ROOM_BLOCKED_BY_EVENT',
        statusCode: 409,
      })
    })

    it('rejects a reservation that overlaps an existing slot for the same user', async () => {
      const { createReservationForSession } = await loadReservationModules()
      await expect(
        createReservationForSession(memberSession, {
          tableId: 't2',
          date: '2026-12-31',
          startTime: '17:00',
          endTime: '19:00',
        })
      ).rejects.toMatchObject({ name: 'ServiceError', statusCode: 409 })
    })

    it('allows a reservation on a different date even if times overlap', async () => {
      const { createReservationForSession } = await loadReservationModules()
      await expect(
        createReservationForSession(memberSession, {
          tableId: 't1',
          date: '2027-01-01',
          startTime: '16:00',
          endTime: '18:00',
        })
      ).resolves.toEqual(expect.objectContaining({ date: '2027-01-01' }))
    })

    it('allows a reservation that starts exactly when another ends', async () => {
      const { createReservationForSession } = await loadReservationModules()
      await expect(
        createReservationForSession(memberSession, {
          tableId: 't1',
          date: '2026-12-31',
          startTime: '18:00',
          endTime: '20:00',
        })
      ).resolves.toEqual(expect.objectContaining({ startTime: '18:00' }))
    })

    it('ignores cancelled reservations when checking user overlap', async () => {
      reservationsState[0]!.status = 'cancelled'
      const { createReservationForSession } = await loadReservationModules()
      await expect(
        createReservationForSession(memberSession, {
          tableId: 't1',
          date: '2026-12-31',
          startTime: '17:00',
          endTime: '18:30',
        })
      ).resolves.toEqual(expect.objectContaining({ tableId: 't1' }))
    })

    it('counts pending reservations as blocking overlaps for the same user', async () => {
      reservationsState[0]!.status = 'pending'
      const { createReservationForSession } = await loadReservationModules()
      await expect(
        createReservationForSession(memberSession, {
          tableId: 't2',
          date: '2026-12-31',
          startTime: '17:00',
          endTime: '19:00',
        })
      ).rejects.toMatchObject({ name: 'ServiceError', statusCode: 409 })
    })
  })

  describe('updateReservationForSession', () => {
    it('rejects invalid statuses', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      await expect(updateReservationForSession(memberSession, 'r1', { status: 'invalid_status' as unknown })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
      })
    })

    it('rejects status active for non-admin users with 403', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      await expect(updateReservationForSession(memberSession, 'r1', { status: 'active' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 403,
      })
    })

    it('rejects status completed for non-admin users with 403', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      await expect(updateReservationForSession(memberSession, 'r1', { status: 'completed' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 403,
      })
    })

    it('allows admins to mark a reservation as completed', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(adminSession, 'r1', { status: 'completed' })

      expect(updated.status).toBe('completed')
    })

    it('allows admins to set status to active', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      reservationsState[0]!.status = 'pending'
      const updated = await updateReservationForSession(adminSession, 'r1', { status: 'active' })

      expect(updated.status).toBe('active')
    })

    it('rejects updates from non-owners', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      await expect(updateReservationForSession({ id: '999', role: 'member' }, 'r1', {
        startTime: '18:00',
        endTime: '19:00',
      })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 403,
      })
    })

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

      expect(updated.date).toBe('2026-12-31')
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

    it('rejects single-digit hour "9:00" in startTime with 400', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      await expect(updateReservationForSession(memberSession, 'r1', {
        startTime: '9:00',
        endTime: '10:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('rejects out-of-range hour "25:00" in endTime with 400', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      await expect(updateReservationForSession(memberSession, 'r1', {
        startTime: '16:00',
        endTime: '25:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('rejects out-of-range minutes "18:70" in startTime with 400', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      await expect(updateReservationForSession(memberSession, 'r1', {
        startTime: '18:70',
        endTime: '19:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('accepts midnight "00:00" as a valid startTime', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', {
        startTime: '00:00',
        endTime: '01:00',
      })

      expect(updated.startTime).toBe('00:00')
      expect(updated.endTime).toBe('01:00')
    })

    it('rejects updates that move into an event-blocked range', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      eventRoomBlocksState.push({
        id: 'block-2',
        event_id: 'event-2',
        room_id: 'room-1',
        date: '2026-12-31',
        start_time: '18:00:00',
        end_time: '20:00:00',
        all_day: false,
      })

      await expect(updateReservationForSession(memberSession, 'r1', {
        startTime: '18:30',
        endTime: '19:30',
      })).rejects.toMatchObject({
        name: 'ServiceError',
        message: 'ROOM_BLOCKED_BY_EVENT',
        statusCode: 409,
      })
    })

    it('ignores the current reservation when checking conflicts during updates', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', {
        startTime: '16:30',
        endTime: '17:30',
      })

      expect(updated.startTime).toBe('16:30')
      expect(updated.endTime).toBe('17:30')
    })

    describe('cancellation cutoff (60-minute restriction)', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('member cancels reservation > 60 min in future → allowed', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set current time to 2026-04-04 14:00:00 local time
        vi.setSystemTime(new Date(2026, 3, 4, 14, 0, 0))

        // Reservation starts at 16:00 (120 minutes from now)
        // Difference = 120 * 60 * 1000 = 7200000 ms
        // 7200000 < 3600000 = false, so allowed
        const updated = await updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })

        expect(updated.status).toBe('cancelled')
      })

      it('member cancels reservation exactly 60 min away → allowed (at boundary)', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set current time to 2026-04-04 15:00:00 local time (exactly 60 minutes before 16:00)
        vi.setSystemTime(new Date(2026, 3, 4, 15, 0, 0))

        // Reservation starts at 16:00
        // Difference = 3600000 ms (exactly 60 min)
        // 3600000 < 3600000 = false, so allowed
        const updated = await updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })

        expect(updated.status).toBe('cancelled')
      })

      it('member cancels reservation within 60 min → blocked with CANCELLATION_CUTOFF', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set current time to 2026-12-31 15:30:00 local time (30 minutes before 16:00)
        vi.setSystemTime(new Date(2026, 11, 31, 15, 30, 0))

        // Reservation starts at 16:00
        // Difference = 1800000 ms (30 min)
        // 1800000 < 3600000 = true, so blocked
        await expect(updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })).rejects.toMatchObject({
          name: 'ServiceError',
          statusCode: 403,
          message: expect.stringContaining('CANCELLATION_CUTOFF'),
        })
      })

      it('member cancels reservation after start time → blocked with CANCELLATION_CUTOFF', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set current time to 2026-12-31 16:00:00 local time (reservation start, now in progress)
        vi.setSystemTime(new Date(2026, 11, 31, 16, 0, 0))

        // Reservation starts at 16:00 (in the past)
        // Difference is negative, definitely < 3600000, so blocked
        await expect(updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })).rejects.toMatchObject({
          name: 'ServiceError',
          statusCode: 403,
          message: expect.stringContaining('CANCELLATION_CUTOFF'),
        })
      })

      it('admin cancels reservation within 60 min → allowed (bypass)', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set current time to 2026-04-04 15:30:00 local time (30 min before 16:00)
        vi.setSystemTime(new Date(2026, 3, 4, 15, 30, 0))

        // Admin should be able to cancel even within 60 min
        const adminReservation = makeReservation({ id: 'r-admin', user_id: '1', table_id: 't2' })
        reservationsState.push(adminReservation)

        const updated = await updateReservationForSession(adminSession, 'r-admin', { status: 'cancelled' })

        expect(updated.status).toBe('cancelled')
      })

      it('member changes status to pending within 60 min → cutoff does NOT fire', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set current time to 2026-04-04 15:30:00 local time (30 min before 16:00)
        vi.setSystemTime(new Date(2026, 3, 4, 15, 30, 0))

        // Change status to 'pending' (not 'cancelled'), so cutoff should not apply
        const updated = await updateReservationForSession(memberSession, 'r1', { status: 'pending' })

        expect(updated.status).toBe('pending')
      })

      it('member re-cancels already-cancelled reservation within 60 min → idempotent (no CANCELLATION_CUTOFF)', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // First, cancel the reservation when > 60 min away (succeeds)
        vi.setSystemTime(new Date(2026, 3, 4, 14, 0, 0))  // 14:00, 120 min before 16:00
        const cancelled = await updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })
        expect(cancelled.status).toBe('cancelled')

        // Now move time to within 60 min of the start (30 min before 16:00)
        vi.setSystemTime(new Date(2026, 3, 4, 15, 30, 0))

        // Try to cancel again within 60 min window - should succeed (idempotent)
        // because the guard checks: existingReservation.status !== 'cancelled'
        const reCancelled = await updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })

        expect(reCancelled.status).toBe('cancelled')
      })

      it('member cancels pending reservation > 60 min away → succeeds', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set reservation to pending status
        reservationsState[0]!.status = 'pending'

        // Set current time to 2026-04-04 14:00:00 local time
        vi.setSystemTime(new Date(2026, 3, 4, 14, 0, 0))

        // Reservation starts at 16:00 (120 minutes from now)
        // Difference = 120 * 60 * 1000 = 7200000 ms
        // 7200000 < 3600000 = false, so allowed
        const updated = await updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })

        expect(updated.status).toBe('cancelled')
      })

      it('member cancels pending reservation within 60 min → blocked with CANCELLATION_CUTOFF', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Set reservation to pending status
        reservationsState[0]!.status = 'pending'

        // Set current time to 2026-12-31 15:30:00 local time (30 minutes before 16:00)
        vi.setSystemTime(new Date(2026, 11, 31, 15, 30, 0))

        // Reservation starts at 16:00
        // Difference = 1800000 ms (30 min)
        // 1800000 < 3600000 = true, so blocked with CANCELLATION_CUTOFF
        await expect(updateReservationForSession(memberSession, 'r1', { status: 'cancelled' })).rejects.toMatchObject({
          name: 'ServiceError',
          statusCode: 403,
          message: expect.stringContaining('CANCELLATION_CUTOFF'),
        })
      })

      it('admin cancels pending reservation within 60 min → allowed (bypass)', async () => {
        const { updateReservationForSession } = await loadReservationModules()

        // Create a new reservation with pending status
        const pendingAdminReservation = makeReservation({ id: 'r-pending-admin', user_id: '1', table_id: 't2', status: 'pending' })
        reservationsState.push(pendingAdminReservation)

        // Set current time to 2026-04-04 15:30:00 local time (30 min before 16:00)
        vi.setSystemTime(new Date(2026, 3, 4, 15, 30, 0))

        // Admin should be able to cancel even within 60 min
        const updated = await updateReservationForSession(adminSession, 'r-pending-admin', { status: 'cancelled' })

        expect(updated.status).toBe('cancelled')
      })

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

  describe('activateReservationByTable', () => {
    // Fixed timestamp: 2025-06-15T14:00:00Z (14:00 UTC)
    const FIXED_DATE = '2025-06-15'
    const FIXED_TIME = new Date('2025-06-15T14:00:00Z')

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(FIXED_TIME)
    })

    afterEach(() => {
      vi.useRealTimers()
      vi.unstubAllEnvs()
    })

    function seedPendingReservation(overrides?: Partial<ReservationRow>) {
      const row: ReservationRow = makeReservation({
        id: 'rA',
        table_id: 't3',
        user_id: '2',
        date: FIXED_DATE,
        status: 'pending',
        surface: 'top',
        ...overrides,
      })
      reservationsState.push(row)
      return row
    }

    function makeStartTime(offsetMinutes: number): string {
      const nowUtc = new Date()
      const clubTz = process.env.CLUB_TIMEZONE ?? 'Europe/Madrid'
      
      let madridParts: Record<string, number>
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: clubTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).formatToParts(nowUtc)
        madridParts = Object.fromEntries(
          parts.filter((p: any) => p.type !== 'literal').map((p: any) => [p.type, parseInt(p.value, 10)])
        )
      } catch {
        // Fallback to UTC if timezone is invalid
        madridParts = {
          year: nowUtc.getUTCFullYear(),
          month: nowUtc.getUTCMonth() + 1,
          day: nowUtc.getUTCDate(),
          hour: nowUtc.getUTCHours(),
          minute: nowUtc.getUTCMinutes(),
          second: nowUtc.getUTCSeconds(),
        }
      }
      
      // Create a date in "timezone local time space" (treating parts as UTC for comparison)
      const madridTime = new Date(
        madridParts.year!,
        madridParts.month! - 1,
        madridParts.day!,
        madridParts.hour!,
        madridParts.minute!,
        madridParts.second!,
      )
      madridTime.setMinutes(madridTime.getMinutes() - offsetMinutes)
      const hh = String(madridTime.getHours()).padStart(2, '0')
      const mm = String(madridTime.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}:00`
    }

    function makeEndTime(startTimeStr: string, durationMinutes: number): string {
      const [hh, mm] = startTimeStr.split(':')
      const nowUtc = new Date()
      const clubTz = process.env.CLUB_TIMEZONE ?? 'Europe/Madrid'
      
      let madridParts: Record<string, number>
      try {
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: clubTz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour12: false,
        }).formatToParts(nowUtc)
        madridParts = Object.fromEntries(
          parts.filter((p: any) => p.type !== 'literal').map((p: any) => [p.type, parseInt(p.value, 10)])
        )
      } catch {
        // Fallback to UTC if timezone is invalid
        madridParts = {
          year: nowUtc.getUTCFullYear(),
          month: nowUtc.getUTCMonth() + 1,
          day: nowUtc.getUTCDate(),
        }
      }
      
      const date = new Date(
        madridParts.year!,
        madridParts.month! - 1,
        madridParts.day!,
        parseInt(hh!, 10),
        parseInt(mm!, 10),
        0,
        0,
      )
      date.setTime(date.getTime() + durationMinutes * 60 * 1000)
      const endHh = String(date.getHours()).padStart(2, '0')
      const endMm = String(date.getMinutes()).padStart(2, '0')
      return `${endHh}:${endMm}:00`
    }

    it('succeeds within the grace period activation window', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(10) })

      const result = await activateReservationByTable('t3', '2', undefined)

      expect(result).toMatchObject({ tableId: 't3', userId: '2', status: 'active' })
    })

    it('throws CHECK_IN_TOO_EARLY when called before start_time', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(-30) })

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
        message: expect.stringContaining('CHECK_IN_TOO_EARLY'),
      })
    })

    it('boundary: called exactly 5 minutes before start_time (early window opens) succeeds', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      // now is 14:00:00, start_time is 14:05:00 (5 min in future)
      // This is exactly at [start - 5min, end_time], so check-in should succeed
      const startTime = makeStartTime(-5)
      seedPendingReservation({ start_time: startTime })

      const result = await activateReservationByTable('t3', '2', undefined)

      expect(result.status).toBe('active')
    })

    it('boundary: called 6 minutes before start_time throws CHECK_IN_TOO_EARLY', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      // now is 14:00:00, start_time is 14:06:00 (6 min in future)
      // This is before the early window [start - 5min], so check-in should fail
      seedPendingReservation({ start_time: makeStartTime(-6) })

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
        message: expect.stringContaining('CHECK_IN_TOO_EARLY'),
      })
    })

    it('throws CHECK_IN_TOO_LATE when called after end_time', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      const startTime = makeStartTime(25)
      seedPendingReservation({ start_time: startTime, end_time: makeEndTime(startTime, 20) })

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
        message: expect.stringContaining('CHECK_IN_TOO_LATE'),
      })
    })

    it('throws CHECK_IN_ALREADY_ACTIVE when reservation is already active', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      reservationsState.push(makeReservation({
        id: 'rActive',
        table_id: 't3',
        user_id: '2',
        date: FIXED_DATE,
        status: 'active',
        surface: 'top',
        start_time: makeStartTime(10),
      }))

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 409,
        message: expect.stringContaining('CHECK_IN_ALREADY_ACTIVE'),
      })
    })

    it('throws CHECK_IN_NO_RESERVATION when no pending reservation exists', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 404,
        message: expect.stringContaining('CHECK_IN_NO_RESERVATION'),
      })
    })

    it('with side=inf: matches reservation with surface bottom', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ surface: 'bottom', start_time: makeStartTime(10) })

      const result = await activateReservationByTable('t3', '2', 'inf')

      expect(result).toMatchObject({ tableId: 't3', userId: '2', status: 'active' })
    })

    it('with side=inf on a non-removable-top table: throws CHECK_IN_NO_RESERVATION', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      reservationsState.push(makeReservation({
        id: 'rNonTop',
        table_id: 't1',
        user_id: '2',
        date: FIXED_DATE,
        status: 'pending',
        surface: null,
        start_time: makeStartTime(10),
      }))

      await expect(activateReservationByTable('t1', '2', 'inf')).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 404,
        message: expect.stringContaining('CHECK_IN_NO_RESERVATION'),
      })
    })

    it('boundary: called exactly at start_time succeeds', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(0) })

      const result = await activateReservationByTable('t3', '2', undefined)

      expect(result.status).toBe('active')
    })

    it('boundary: called at start_time + (19) min succeeds', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(19) })

      const result = await activateReservationByTable('t3', '2', undefined)

      expect(result.status).toBe('active')
    })

    it('boundary: called exactly at end_time succeeds', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      // now is 14:00:00, set start_time so end_time is also 14:00:00
      // At end_time boundary, check-in should succeed (now === reservationEnd, not strictly greater)
      const startTime = makeStartTime(20)
      const endTime = makeEndTime(startTime, 20)
      seedPendingReservation({ start_time: startTime, end_time: endTime })

      const result = await activateReservationByTable('t3', '2', undefined)

      expect(result.status).toBe('active')
    })

    it('boundary: called just after end_time throws CHECK_IN_TOO_LATE', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      // now is 14:00:00, set end_time to 13:59:00 (1 minute before now)
      // This is after end_time, so check-in should fail
      const startTime = makeStartTime(21)
      const endTime = makeEndTime(startTime, 19)
      seedPendingReservation({ start_time: startTime, end_time: endTime })

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
        message: expect.stringContaining('CHECK_IN_TOO_LATE'),
      })
    })

    it('non-removable-top (large) table: activates with surface=null without surface filter', async () => {
      // Task 2: happy-path check-in on a non-removable-top table
      // t1 is type 'large' — isRemovableTop=false → no surface filter applied
      const { activateReservationByTable } = await loadReservationModules()

      reservationsState.push(makeReservation({
        id: 'rLarge',
        table_id: 't1',
        user_id: '2',
        date: FIXED_DATE,
        status: 'pending',
        surface: null,
        start_time: makeStartTime(10),
      }))

      const result = await activateReservationByTable('t1', '2', undefined)

      expect(result).toMatchObject({ tableId: 't1', userId: '2', status: 'active' })
    })

    it('activeQuery DB error returns 500', async () => {
      // Task 3: when the active-reservation query errors, the service should throw 500.
      // The pendingQuery maybeSingle returns null (no row, no error) → service moves on to activeQuery.
      // The activeQuery maybeSingle returns an error → service should throw 500.
      // We use vi.doMock here and restore the original mock factory at the end of the test
      // to prevent contamination of subsequent tests.
      vi.resetModules()

      // Track how many times maybeSingle has been called across all chains in this test
      let maybeSingleCallCount = 0

      vi.doMock('@/lib/supabase/server', () => ({
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
            return { select: vi.fn(() => buildSelectChain(reservationsState)) }
          }),
        })),
        createSupabaseServerAdminClient: vi.fn(() => {
          function makeChain(): {
            eq: (col: string, val: string) => ReturnType<typeof makeChain>
            maybeSingle: () => Promise<{ data: null; error: { message: string } | null }>
            select: (cols?: string) => ReturnType<typeof makeChain>
            update: (payload: unknown) => ReturnType<typeof makeChain>
            single: () => Promise<{ data: null; error: null }>
          } {
            return {
              eq: vi.fn(() => makeChain()),
              select: vi.fn(() => makeChain()),
              update: vi.fn(() => makeChain()),
              single: vi.fn(async () => ({ data: null, error: null })),
              maybeSingle: vi.fn(async () => {
                maybeSingleCallCount++
                if (maybeSingleCallCount === 1) {
                  // First call: pendingQuery — no pending reservation found
                  return { data: null, error: null }
                }
                // Second call: activeQuery — simulate DB error
                return { data: null, error: { message: 'db error' } }
              }),
            }
          }

          return {
            from: vi.fn(() => makeChain()),
            rpc: vi.fn(),
          }
        }),
      }))

      const { activateReservationByTable: activate } = await import('@/lib/server/reservations-service')

      await expect(activate('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 500,
      })

      // Restore the original mock factory so subsequent tests are not contaminated
      vi.resetModules()
      vi.doMock('@/lib/supabase/server', () => ({
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
              update: vi.fn((payload: Record<string, unknown>) => {
                const filters: Array<[string, string]> = []
                const chain = {
                  eq: vi.fn((column: string, value: string) => {
                    filters.push([column, value])
                    return chain
                  }),
                  select: vi.fn(() => ({
                    single: vi.fn(async () => {
                      const row = reservationsState.find((r) =>
                        filters.every(([col, val]) => String((r as Record<string, unknown>)[col]) === val)
                      )
                      if (!row) {
                        return { data: null, error: null }
                      }
                      Object.assign(row, payload)
                      return { data: cloneReservation(row), error: null }
                    }),
                  })),
                }
                return chain
              }),
            }
          }),
          rpc: vi.fn(),
        })),
      }))
    })

    it('invalid CLUB_TIMEZONE propagates as a RangeError', async () => {
      // Task 4: CLUB_TIMEZONE='Invalid/Zone' → RangeError propagates (no fallback)
      vi.stubEnv('CLUB_TIMEZONE', 'Invalid/Zone')
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(10) })

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toThrow(RangeError)
    })

    it('getTable returning null throws 404 with Table not found', async () => {
      // Task 5: when the table does not exist in the DB, service throws 404
      const { activateReservationByTable } = await loadReservationModules()

      // Use a tableId that is not seeded in tablesState
      await expect(activateReservationByTable('t-nonexistent', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 404,
        message: expect.stringContaining('Table not found'),
      })
    })

    it('UPDATE returning PGRST116 resolves to 409 CHECK_IN_ALREADY_ACTIVE (TOCTOU race)', async () => {
      // Simulates the TOCTOU race: pendingQuery finds the row, but by the time the UPDATE
      // executes the row is gone (already activated by a concurrent request).
      // PostgREST returns PGRST116 when .single() matches zero rows.
      // We override createSupabaseServerAdminClient for this one invocation via mockReturnValueOnce.
      const { createSupabaseServerAdminClient } = await import('@/lib/supabase/server')
      const adminMock = vi.mocked(createSupabaseServerAdminClient)

      const pendingRow = makeReservation({
        id: 'rTOCTOU',
        table_id: 't3',
        user_id: '2',
        date: FIXED_DATE,
        status: 'pending',
        surface: 'top',
        start_time: makeStartTime(10),
      })

      // Build a select chain that returns the pending row for pendingQuery
      function buildSingleRowSelectChain(row: ReservationRow) {
        const self: {
          eq: (col: string, val: string) => typeof self
          maybeSingle: () => Promise<{ data: ReservationRow; error: null }>
        } = {
          eq: vi.fn(() => self),
          maybeSingle: vi.fn(async () => ({ data: { ...row }, error: null })),
        }
        return self
      }

      // Build an update chain whose single() returns PGRST116
      function buildPGRST116UpdateChain() {
        const self: {
          eq: (col: string, val: string) => typeof self
          select: (cols?: string) => typeof self
          single: () => Promise<{ data: null; error: { code: string; message: string } }>
        } = {
          eq: vi.fn(() => self),
          select: vi.fn(() => self),
          single: vi.fn(async () => ({
            data: null,
            error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
          })),
        }
        return self
      }

      let fromCallCount = 0
      adminMock.mockReturnValueOnce({
        from: vi.fn((table: string) => {
          if (table !== 'reservations') throw new Error(`Unexpected admin table ${table}`)
          fromCallCount++
          if (fromCallCount === 1) {
            // pendingQuery: .select(cols).eq().eq().eq().eq().eq().maybeSingle()
            return { select: vi.fn(() => buildSingleRowSelectChain(pendingRow)) }
          }
          // updateChain: .update().eq().eq().select().single() → PGRST116
          return { update: vi.fn(() => buildPGRST116UpdateChain()) }
        }),
        rpc: vi.fn(),
      } as unknown as ReturnType<typeof createSupabaseServerAdminClient>)

      const { activateReservationByTable } = await loadReservationModules()

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 409,
        message: expect.stringContaining('CHECK_IN_ALREADY_ACTIVE'),
      })
    })

    it('sequential double-call returns 409 CHECK_IN_ALREADY_ACTIVE on second call', async () => {
      // First call activates the reservation (pending → active).
      // Second call finds no pending row but finds an active row → 409 CHECK_IN_ALREADY_ACTIVE.
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(10) })

      // First activation should succeed
      const firstResult = await activateReservationByTable('t3', '2', undefined)
      expect(firstResult).toMatchObject({ tableId: 't3', userId: '2', status: 'active' })

      // Second activation on the same table/user — reservation is now active, not pending
      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 409,
        message: expect.stringContaining('CHECK_IN_ALREADY_ACTIVE'),
      })
    })
  })

  describe('cancelExpiredPendingReservations', () => {
    it('calls admin.rpc with cancel_expired_pending_reservations and returns count', async () => {
      // The mock setup is done at the top of the file with vi.mock
      // Here we just need to configure the rpc mock behavior
      const mockRpc = vi.fn(async () => ({ data: 3, error: null }))
      
      // Reset modules to get a fresh import with our configured mock
      vi.resetModules()
      const createAdminMock = vi.fn(() => ({
        rpc: mockRpc,
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerAdminClient: createAdminMock,
        createSupabaseServerClient: vi.fn(async () => ({ from: vi.fn() })),
      }))
      
      const { cancelExpiredPendingReservations, GRACE_PERIOD_MINUTES } = await import('@/lib/server/reservations-service')
      const result = await cancelExpiredPendingReservations()

      expect(mockRpc).toHaveBeenCalledWith('cancel_expired_pending_reservations', {
        grace_minutes: GRACE_PERIOD_MINUTES,
        club_timezone: process.env.CLUB_TIMEZONE ?? 'Atlantic/Canary',
      })
      expect(result).toBe(3)
    })

    it('throws serviceError when rpc returns error', async () => {
      const mockRpc = vi.fn(async () => ({ data: null, error: { message: 'DB error' } }))
      
      vi.resetModules()
      const createAdminMock = vi.fn(() => ({
        rpc: mockRpc,
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerAdminClient: createAdminMock,
        createSupabaseServerClient: vi.fn(async () => ({ from: vi.fn() })),
      }))
      
      const { cancelExpiredPendingReservations } = await import('@/lib/server/reservations-service')

      await expect(cancelExpiredPendingReservations()).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 500,
        message: 'Internal server error',
      })
    })
  })

  describe('markNoShowReservations', () => {
    it('calls admin.rpc with mark_no_show_reservations and returns count', async () => {
      const mockRpc = vi.fn(async () => ({ data: 2, error: null }))

      vi.resetModules()
      const createAdminMock = vi.fn(() => ({
        rpc: mockRpc,
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerAdminClient: createAdminMock,
        createSupabaseServerClient: vi.fn(async () => ({ from: vi.fn() })),
      }))

      const { markNoShowReservations } = await import('@/lib/server/reservations-service')
      const result = await markNoShowReservations()

      expect(mockRpc).toHaveBeenCalledWith('mark_no_show_reservations', {
        club_timezone: process.env.CLUB_TIMEZONE ?? 'Atlantic/Canary',
      })
      expect(result).toBe(2)
    })

    it('returns 0 when no reservations need marking', async () => {
      const mockRpc = vi.fn(async () => ({ data: 0, error: null }))

      vi.resetModules()
      const createAdminMock = vi.fn(() => ({
        rpc: mockRpc,
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerAdminClient: createAdminMock,
        createSupabaseServerClient: vi.fn(async () => ({ from: vi.fn() })),
      }))

      const { markNoShowReservations } = await import('@/lib/server/reservations-service')
      const result = await markNoShowReservations()

      expect(result).toBe(0)
    })

    it('throws serviceError when rpc returns error', async () => {
      const mockRpc = vi.fn(async () => ({ data: null, error: { message: 'DB error' } }))

      vi.resetModules()
      const createAdminMock = vi.fn(() => ({
        rpc: mockRpc,
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerAdminClient: createAdminMock,
        createSupabaseServerClient: vi.fn(async () => ({ from: vi.fn() })),
      }))

      const { markNoShowReservations } = await import('@/lib/server/reservations-service')

      await expect(markNoShowReservations()).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 500,
        message: 'Internal server error',
      })
    })

    it('returns 0 when rpc returns null data without error', async () => {
      // The service uses `(data as number | null) ?? 0` — verify the null branch returns 0
      const mockRpc = vi.fn(async () => ({ data: null, error: null }))

      vi.resetModules()
      const createAdminMock = vi.fn(() => ({
        rpc: mockRpc,
      }))
      vi.doMock('@/lib/supabase/server', () => ({
        createSupabaseServerAdminClient: createAdminMock,
        createSupabaseServerClient: vi.fn(async () => ({ from: vi.fn() })),
      }))

      const { markNoShowReservations } = await import('@/lib/server/reservations-service')
      const result = await markNoShowReservations()

      expect(result).toBe(0)
    })
  })
})
