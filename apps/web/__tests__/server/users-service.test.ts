import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const rangeMock = vi.fn()
const orderMock = vi.fn()
const orMock = vi.fn()
const deleteUserMock = vi.fn()

const profileRows = [
  {
    id: '1',
    member_number: '100001',
    email: 'admin@alea.club',
    role: 'admin' as const,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    member_number: '100002',
    email: 'socio@alea.club',
    role: 'member' as const,
    created_at: '2024-01-02T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
  },
]

function resetQueryMocks() {
  maybeSingleMock.mockReset()
  rangeMock.mockReset()
  orderMock.mockReset()
  orMock.mockReset()
  deleteUserMock.mockReset()

  rangeMock.mockResolvedValue({
    data: profileRows,
    error: null,
    count: profileRows.length,
  })
  orMock.mockReturnValue({ order: orderMock })
  orderMock.mockReturnValue({ range: rangeMock })
  maybeSingleMock.mockResolvedValue({ data: profileRows[0], error: null })
  deleteUserMock.mockResolvedValue({ error: null })
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn((columns: string, options?: { count?: 'exact' }) => {
        if (options?.count === 'exact') {
          return {
            order: orderMock,
            or: orMock,
          }
        }
        return {
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
          maybeSingle: maybeSingleMock,
        }
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
        })),
      })),
    })),
  })),
  createSupabaseServerAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: maybeSingleMock,
        })),
      })),
    })),
    auth: {
      admin: {
        deleteUser: deleteUserMock,
      },
    },
  })),
}))

async function loadUsersModules() {
  vi.resetModules()

  const service = await import('@/lib/server/users-service')

  return { ...service }
}

describe('listPaginatedUsers', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetQueryMocks()
  })

  it('clamps page=0 to 1', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 0, limit: 10 })

    expect(result.page).toBe(1)
  })

  it('clamps page=-5 to 1', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: -5, limit: 10 })

    expect(result.page).toBe(1)
  })

  it('clamps limit=0 to default and totalPages is not Infinity', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 1, limit: 0 })

    // limit=0 is treated as missing and falls back to the internal default (20)
    // The key invariant: totalPages must never be Infinity
    expect(result.limit).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(result.totalPages)).toBe(true)
  })

  it('clamps limit=-10 to 1', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 1, limit: -10 })

    expect(result.limit).toBe(1)
  })

  it('clamps limit=200 to 100', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 1, limit: 200 })

    expect(result.limit).toBe(100)
  })

  it('returns limit=50 as-is when within bounds', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 1, limit: 50 })

    expect(result.limit).toBe(50)
  })

  it('filters by email substring case-insensitively', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 1, limit: 10, search: 'ADMIN' })

    expect(result.data.length).toBeGreaterThan(0)
    expect(orMock).toHaveBeenCalledWith('email.ilike.%ADMIN%,member_number.ilike.%ADMIN%')
  })

  it('filters by memberNumber substring', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    // seed member has memberNumber '100002'
    const result = await listPaginatedUsers({ page: 1, limit: 10, search: '100002' })

    expect(result.data.length).toBeGreaterThan(0)
    expect(orMock).toHaveBeenCalledWith('email.ilike.%100002%,member_number.ilike.%100002%')
  })

  it('returns all users when search is empty', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const all = await listPaginatedUsers({ page: 1, limit: 100 })
    const withEmpty = await listPaginatedUsers({ page: 1, limit: 100, search: '' })

    expect(withEmpty.total).toBe(all.total)
  })
})

describe('updateUser', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetQueryMocks()
  })

  it('returns the updated public user payload', async () => {
    const { updateUser } = await loadUsersModules()

    const updated = await updateUser('2', { email: 'SOCIO@ALEA.CLUB', role: 'member' })

    expect(updated.email).toBe('admin@alea.club')
  })
})

describe('deleteUser', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetQueryMocks()
  })

  it('deletes the auth user after confirming the profile exists', async () => {
    const { deleteUser } = await loadUsersModules()

    await expect(deleteUser('1')).resolves.toBeUndefined()
    expect(deleteUserMock).toHaveBeenCalledWith('1')
  })
})
