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
    activated_at: null,
    created_at: '2026-04-04T10:00:00.000Z',
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
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn((column: string, value: string) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const row = reservationsState.find((r) => String((r as Record<string, unknown>)[column]) === value)
                if (!row) {
                  return { data: null, error: null }
                }
                Object.assign(row, payload)
                return { data: cloneReservation(row), error: null }
              }),
            })),
          })),
        })),
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
        date: '2026-04-05',
        startTime: '12:00',
        endTime: '13:00',
      })

      expect(created).toEqual(expect.objectContaining({
        tableId: 't1',
        userId: '2',
        date: '2026-04-05',
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

    it('rejects single-digit hour "9:00" with 400', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-04-05',
        startTime: '9:00',
        endTime: '10:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('rejects out-of-range hour "25:00" with 400', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-04-05',
        startTime: '25:00',
        endTime: '26:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('rejects out-of-range minutes "18:70" with 400', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-04-05',
        startTime: '18:70',
        endTime: '19:00',
      })).rejects.toMatchObject({ name: 'ServiceError', statusCode: 400 })
    })

    it('accepts midnight "00:00" as a valid time', async () => {
      const { createReservationForSession } = await loadReservationModules()

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-04-05',
        startTime: '00:00',
        endTime: '01:00',
      })).resolves.toEqual(expect.objectContaining({ startTime: '00:00', endTime: '01:00' }))
    })

    it('ignores non-active reservations when checking conflicts', async () => {
      const { createReservationForSession } = await loadReservationModules()

      reservationsState[0]!.status = 'cancelled'

      await expect(createReservationForSession(memberSession, {
        tableId: 't1',
        date: '2026-04-04',
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

    it('ignores the current reservation when checking conflicts during updates', async () => {
      const { updateReservationForSession } = await loadReservationModules()

      const updated = await updateReservationForSession(memberSession, 'r1', {
        startTime: '16:30',
        endTime: '17:30',
      })

      expect(updated.startTime).toBe('16:30')
      expect(updated.endTime).toBe('17:30')
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
      const now = new Date()
      now.setMinutes(now.getMinutes() - offsetMinutes)
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}:00`
    }

    it('succeeds within the 20-minute activation window', async () => {
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

    it('throws CHECK_IN_TOO_LATE when called more than 20 minutes after start_time', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(25) })

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

    it('boundary: called at start_time+19min succeeds (still within window)', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(19) })

      const result = await activateReservationByTable('t3', '2', undefined)

      expect(result.status).toBe('active')
    })

    it('boundary: called at start_time+21min throws CHECK_IN_TOO_LATE', async () => {
      const { activateReservationByTable } = await loadReservationModules()

      seedPendingReservation({ start_time: makeStartTime(21) })

      await expect(activateReservationByTable('t3', '2', undefined)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
        message: expect.stringContaining('CHECK_IN_TOO_LATE'),
      })
    })
  })
})
