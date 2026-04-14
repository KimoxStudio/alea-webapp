import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const rangeMock = vi.fn()
const orderMock = vi.fn()
const orMock = vi.fn()
const deleteUserMock = vi.fn()
let capturedOrFilter: string | undefined
const eqMock = vi.fn()
const listQuery = {
  order: orderMock,
  or: orMock,
  eq: eqMock,
}

const profileRows = [
  {
    id: '1',
    member_number: '100001',
    full_name: 'Admin User',
    auth_email: '100001@members.alea.internal',
    email: 'admin@alea.club',
    phone: '600000001',
    role: 'admin' as const,
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    member_number: '100002',
    full_name: 'Member User',
    auth_email: '100002@members.alea.internal',
    email: 'socio@alea.club',
    phone: '600000002',
    role: 'member' as const,
    is_active: true,
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
  eqMock.mockReset()

  capturedOrFilter = undefined
  eqMock.mockImplementation(() => listQuery)
  orMock.mockImplementation((filter: string) => {
    capturedOrFilter = filter
    const match = filter.match(/ilike\.%([^%]+)%/)
    const filtered = match
      ? profileRows.filter((r) => (
        r.member_number.toLowerCase().includes(match[1].toLowerCase())
        || r.full_name.toLowerCase().includes(match[1].toLowerCase())
        || r.email.toLowerCase().includes(match[1].toLowerCase())
      ))
      : profileRows
    rangeMock.mockResolvedValue({ data: filtered, error: null, count: filtered.length })
    return { order: orderMock }
  })
  rangeMock.mockResolvedValue({
    data: profileRows,
    error: null,
    count: profileRows.length,
  })
  orderMock.mockReturnValue({ range: rangeMock })
  maybeSingleMock.mockResolvedValue({ data: profileRows[0], error: null })
  deleteUserMock.mockResolvedValue({ error: null })
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn((columns: string, options?: { count?: 'exact' }) => {
        if (options?.count === 'exact') {
          return listQuery
        }
        return {
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
          maybeSingle: maybeSingleMock,
        }
      }),
    })),
  })),
  createSupabaseServerAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn((columns: string, options?: { count?: 'exact' }) => {
        if (options?.count === 'exact') {
          return listQuery
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

  it('filters by memberNumber substring case-insensitively', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    await listPaginatedUsers({ page: 1, limit: 10, search: 'ADMIN' })

    expect(orMock).toHaveBeenCalledWith('member_number.ilike.%ADMIN%,full_name.ilike.%ADMIN%,email.ilike.%ADMIN%')
    expect(capturedOrFilter).toBe('member_number.ilike.%ADMIN%,full_name.ilike.%ADMIN%,email.ilike.%ADMIN%')
  })

  it('filters by memberNumber substring', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    // seed member has memberNumber '100002'
    const result = await listPaginatedUsers({ page: 1, limit: 10, search: '100002' })

    expect(result.data.length).toBeGreaterThan(0)
    expect(orMock).toHaveBeenCalledWith('member_number.ilike.%100002%,full_name.ilike.%100002%,email.ilike.%100002%')
  })

  it('filters by full name substring', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 1, limit: 10, search: 'member user' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.id).toBe('2')
  })

  it('filters by email substring', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = await listPaginatedUsers({ page: 1, limit: 10, search: 'admin@alea.club' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.id).toBe('1')
  })

  it('returns all users when search is empty', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const all = await listPaginatedUsers({ page: 1, limit: 100 })
    const withEmpty = await listPaginatedUsers({ page: 1, limit: 100, search: '' })

    expect(withEmpty.total).toBe(all.total)
  })

  it('does not filter out suspended users from the admin listing', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    await listPaginatedUsers({ page: 1, limit: 10 })

    expect(eqMock).not.toHaveBeenCalledWith('is_active', true)
  })
})

describe('updateUser', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetQueryMocks()
  })

  async function mockAdminClientForUpdateUser() {
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((_column: string, value: string) => ({
            maybeSingle: vi.fn(async () => ({
              data: profileRows.find((row) => row.id === value) ?? null,
              error: null,
            })),
          })),
        })),
        update: vi.fn((updates: Record<string, unknown>) => ({
          eq: vi.fn((_column: string, value: string) => ({
            select: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({
                data: (() => {
                  const row = profileRows.find((profile) => profile.id === value)
                  return row ? { ...row, ...updates } : null
                })(),
                error: null,
              })),
            })),
          })),
        })),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
  }

  it('returns the updated public user payload for the correct user id', async () => {
    await mockAdminClientForUpdateUser()
    const { updateUser } = await loadUsersModules()

    const updated = await updateUser('2', { role: 'member' })

    expect(updated.id).toBe('2')
    expect(updated.id).not.toBe('1')
  })

  it('throws 400 when no updatable fields are provided', async () => {
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', {})).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
  })

  it('throws 400 when memberNumber exceeds 10 digits', async () => {
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { memberNumber: '1'.repeat(11) })).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
  })

  it('accepts memberNumber of exactly 10 digits', async () => {
    await mockAdminClientForUpdateUser()
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { memberNumber: '1'.repeat(10) })).resolves.toBeDefined()
  })

  it('throws 400 when memberNumber contains non-numeric characters', async () => {
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { memberNumber: 'abc12' })).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 400 when memberNumber is null (coerced to string "null")', async () => {
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { memberNumber: null as unknown as string })).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
  })

  it('throws 400 when memberNumber is an empty string', async () => {
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { memberNumber: '' })).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
  })

  it('accepts memberNumber of single digit zero', async () => {
    await mockAdminClientForUpdateUser()
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { memberNumber: '0' })).resolves.toBeDefined()
  })

  it('accepts is_active boolean and includes it in the update', async () => {
    let capturedUpdates: Record<string, unknown> | undefined
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
          maybeSingle: maybeSingleMock,
        })),
        update: vi.fn((updates: Record<string, unknown>) => {
          capturedUpdates = updates
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: maybeSingleMock,
              })),
            })),
          }
        }),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
    const { updateUser } = await loadUsersModules()

    await updateUser('1', { is_active: false })

    expect(capturedUpdates).toMatchObject({ is_active: false })
  })

  it('accepts fullName, email, and phone updates', async () => {
    let capturedUpdates: Record<string, unknown> | undefined
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
          maybeSingle: maybeSingleMock,
        })),
        update: vi.fn((updates: Record<string, unknown>) => {
          capturedUpdates = updates
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: maybeSingleMock,
              })),
            })),
          }
        }),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
    const { updateUser } = await loadUsersModules()

    await updateUser('1', { fullName: 'Updated User', email: 'updated@alea.club', phone: '699000111' })

    expect(capturedUpdates).toMatchObject({
      full_name: 'Updated User',
      email: 'updated@alea.club',
      phone: '699000111',
    })
  })

  it('keeps internal auth email aligned when memberNumber changes', async () => {
    let capturedUpdates: Record<string, unknown> | undefined
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
          maybeSingle: maybeSingleMock,
        })),
        update: vi.fn((updates: Record<string, unknown>) => {
          capturedUpdates = updates
          return {
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: maybeSingleMock,
              })),
            })),
          }
        }),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
    const { updateUser } = await loadUsersModules()

    await updateUser('1', { memberNumber: '100123' })

    expect(capturedUpdates).toMatchObject({
      member_number: '100123',
      auth_email: '100123@members.alea.internal',
    })
  })

  it('rejects blank fullName updates', async () => {
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { fullName: '   ' })).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
  })

  it('rejects is_active when provided as a non-boolean string', async () => {
    const { updateUser } = await loadUsersModules()

    await expect(updateUser('1', { is_active: 'false' })).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 400,
    })
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

describe('resetNoShows', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetQueryMocks()
  })

  it('sets no_show_count=0 and blocked_until=null for the user', async () => {
    let capturedUpdates: Record<string, unknown> | undefined
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
          maybeSingle: maybeSingleMock,
        })),
        update: vi.fn((updates: Record<string, unknown>) => {
          capturedUpdates = updates
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          }
        }),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
    const { resetNoShows } = await loadUsersModules()

    await resetNoShows('user-123')

    expect(capturedUpdates).toEqual({ no_show_count: 0, blocked_until: null })
  })

  it('throws a service error when update fails', async () => {
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
          maybeSingle: maybeSingleMock,
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: new Error('DB error') }),
        })),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
    const { resetNoShows } = await loadUsersModules()

    await expect(resetNoShows('user-123')).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 500,
    })
  })
})

describe('unblockUser', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    resetQueryMocks()
  })

  it('sets blocked_until=null for the user', async () => {
    let capturedUpdates: Record<string, unknown> | undefined
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
          maybeSingle: maybeSingleMock,
        })),
        update: vi.fn((updates: Record<string, unknown>) => {
          capturedUpdates = updates
          return {
            eq: vi.fn().mockResolvedValue({ error: null }),
          }
        }),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
    const { unblockUser } = await loadUsersModules()

    await unblockUser('user-456')

    expect(capturedUpdates).toEqual({ blocked_until: null })
  })

  it('throws a service error when update fails', async () => {
    vi.mocked(
      (await import('@/lib/supabase/server')).createSupabaseServerAdminClient
    ).mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: maybeSingleMock,
          })),
          maybeSingle: maybeSingleMock,
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: new Error('DB error') }),
        })),
      })),
      auth: { admin: { deleteUser: deleteUserMock } },
    } as never)
    const { unblockUser } = await loadUsersModules()

    await expect(unblockUser('user-456')).rejects.toMatchObject({
      name: 'ServiceError',
      statusCode: 500,
    })
  })
})
