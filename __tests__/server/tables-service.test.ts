import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const listReservationsMock = vi.fn()
const adminTableMaybeSingleMock = vi.fn()
const adminUpdateEqMock = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'tables') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
        }
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: listReservationsMock,
            })),
          })),
        })),
      }
    }),
  })),
  createSupabaseServerAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'tables') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: adminTableMaybeSingleMock,
            })),
          })),
          update: vi.fn(() => ({
            eq: adminUpdateEqMock,
          })),
        }
      }

      // reservations table for getTableAvailability
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: listReservationsMock,
            })),
          })),
        })),
      }
    }),
  })),
}))

async function loadTablesModules() {
  vi.resetModules()
  return import('@/lib/server/tables-service')
}

describe('getTableAvailability', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    maybeSingleMock.mockResolvedValue({
      data: {
        id: 't3',
        room_id: '1',
        name: 'Mesa 3',
        type: 'removable_top',
        qr_code: 'QR-3',
        pos_x: 1,
        pos_y: 1,
      },
      error: null,
    })
    listReservationsMock.mockResolvedValue({
      data: [
        {
          id: 'r2',
          table_id: 't3',
          date: '2025-01-01',
          start_time: '10:00:00',
          end_time: '12:00:00',
          status: 'active',
          surface: 'top',
          user_id: '2',
          created_at: '2025-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    })
  })

  it('builds removable-top availability from Supabase reservations', async () => {
    const { getTableAvailability } = await loadTablesModules()

    const availability = await getTableAvailability('t3', '2025-01-01')

    expect(availability.top?.some((slot) => slot.startTime === '10:00' && !slot.available)).toBe(true)
    expect(availability.bottom?.every((slot) => slot.available)).toBe(true)
  })
})

describe('generateTableQrCode', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com'
  })

  it('returns a base64 data URL starting with data:image/png;base64,', async () => {
    const { generateTableQrCode } = await loadTablesModules()

    const result = await generateTableQrCode('table-abc')

    expect(result).toMatch(/^data:image\/png;base64,/)
  })

  it('encodes the absolute URL with the tableId in the QR payload', async () => {
    const { generateTableQrCode } = await loadTablesModules()

    const result = await generateTableQrCode('table-abc')

    expect(result.length).toBeGreaterThan(100)
    expect(typeof result).toBe('string')
  })
})

describe('regenerateQrCodes', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com'
    adminUpdateEqMock.mockResolvedValue({ error: null })
  })

  it('for a non-removable-top table: qr_code is set, qr_code_inf is null', async () => {
    adminTableMaybeSingleMock.mockResolvedValue({
      data: { id: 't1', type: 'large' },
      error: null,
    })

    const { regenerateQrCodes } = await loadTablesModules()

    const result = await regenerateQrCodes('t1')

    expect(result.qr_code).toMatch(/^data:image\/png;base64,/)
    expect(result.qr_code_inf).toBeNull()
  })

  it('for a removable-top table: both qr_code and qr_code_inf are set', async () => {
    adminTableMaybeSingleMock.mockResolvedValue({
      data: { id: 't3', type: 'removable_top' },
      error: null,
    })

    const { regenerateQrCodes } = await loadTablesModules()

    const result = await regenerateQrCodes('t3')

    expect(result.qr_code).toMatch(/^data:image\/png;base64,/)
    expect(result.qr_code_inf).toMatch(/^data:image\/png;base64,/)
  })
})
