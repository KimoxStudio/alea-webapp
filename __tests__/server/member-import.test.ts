import { beforeEach, describe, expect, it, vi } from 'vitest'

const createUserMock = vi.fn()
const deleteUserMock = vi.fn()

const profileState = new Map<string, {
  id: string
  member_number: string
  full_name: string | null
  auth_email: string
  email: string | null
  phone: string | null
  role: 'member' | 'admin'
  is_active: boolean
  active_from: string | null
  psw_changed: string | null
  no_show_count: number
  blocked_until: string | null
  created_at: string
  updated_at: string
}>()

function resetProfileState() {
  profileState.clear()
  profileState.set('100001', {
    id: 'user-100001',
    member_number: '100001',
    full_name: 'Existing Member',
    auth_email: '100001@members.alea.internal',
    email: 'existing@alea.club',
    phone: '600111222',
    role: 'member',
    is_active: true,
    active_from: '2026-04-01T00:00:00.000Z',
    psw_changed: null,
    no_show_count: 0,
    blocked_until: null,
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
  })
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: 'member_number' | 'id', value: string) => ({
          maybeSingle: vi.fn(async () => {
            const data = column === 'member_number'
              ? profileState.get(value) ?? null
              : Array.from(profileState.values()).find((row) => row.id === value) ?? null
            return { data, error: null }
          }),
        })),
      })),
      update: vi.fn((updates: Record<string, unknown>) => ({
        eq: vi.fn((_column: 'id', value: string) => ({
          select: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              const target = Array.from(profileState.values()).find((row) => row.id === value)
              if (!target) {
                return { data: null, error: { message: 'not found' } }
              }

              const next = {
                ...target,
                ...updates,
                updated_at: '2026-04-14T00:00:00.000Z',
              }
              profileState.delete(target.member_number)
              profileState.set(next.member_number, next)
              return { data: next, error: null }
            }),
          })),
        })),
      })),
    })),
    auth: {
      admin: {
        createUser: createUserMock,
        deleteUser: deleteUserMock,
      },
    },
  })),
}))

async function loadService() {
  vi.resetModules()
  return import('@/lib/server/users-service')
}

describe('parseMemberImportCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProfileState()
  })

  it('parses the expected USUARIOS / ID CSV shape', async () => {
    const { parseMemberImportCsv } = await loadService()

    const result = parseMemberImportCsv(
      'USUARIOS,ID,email,phone\nJohn Doe,100010,john@alea.club,600123123\n'
    )

    expect(result.issues).toEqual([])
    expect(result.normalizedRows).toEqual([
      {
        rowNumber: 2,
        memberNumber: '100010',
        fullName: 'John Doe',
        email: 'john@alea.club',
        phone: '600123123',
      },
    ])
  })

  it('supports semicolon-delimited CSV files', async () => {
    const { parseMemberImportCsv } = await loadService()

    const result = parseMemberImportCsv(
      'USUARIOS;ID;email\nJane Doe;100011;jane@alea.club\n'
    )

    expect(result.normalizedRows[0]?.memberNumber).toBe('100011')
    expect(result.issues).toEqual([])
  })

  it('reports duplicate member numbers in the same file', async () => {
    const { parseMemberImportCsv } = await loadService()

    const result = parseMemberImportCsv(
      'USUARIOS,ID\nOne,100012\nTwo,100012\n'
    )

    expect(result.normalizedRows).toHaveLength(1)
    expect(result.issues).toEqual([
      { rowNumber: 3, memberNumber: '100012', code: 'duplicate_member_number' },
    ])
  })

  it('accepts CSV files with UTF-8 BOM headers', async () => {
    const { parseMemberImportCsv } = await loadService()

    const result = parseMemberImportCsv(
      '\uFEFFUSUARIOS,ID\nJohn Doe,100099\n'
    )

    expect(result.normalizedRows).toEqual([
      expect.objectContaining({
        memberNumber: '100099',
        fullName: 'John Doe',
      }),
    ])
    expect(result.totalRows).toBe(1)
  })

  it('throws when required headers are missing', async () => {
    const { parseMemberImportCsv } = await loadService()

    expect(() => parseMemberImportCsv('name,email\nJohn,john@alea.club\n')).toThrowError()
  })
})

describe('importMembersFromCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetProfileState()
    createUserMock.mockImplementation(async ({ email }: { email: string }) => {
      profileState.set('M-PLACEHOLDER-100020', {
        id: 'user-100020',
        member_number: 'M-PLACEHOLDER-100020',
        full_name: null,
        auth_email: email,
        email: null,
        phone: null,
        role: 'member',
        is_active: false,
        active_from: null,
        psw_changed: null,
        no_show_count: 0,
        blocked_until: null,
        created_at: '2026-04-14T00:00:00.000Z',
        updated_at: '2026-04-14T00:00:00.000Z',
      })
      return {
        data: { user: { id: 'user-100020' } },
        error: null,
      }
    })
    deleteUserMock.mockResolvedValue({ error: null })
  })

  it('updates existing members and preserves missing optional fields', async () => {
    const { importMembersFromCsv } = await loadService()

    const result = await importMembersFromCsv(
      'USUARIOS,ID,email,phone\nUpdated Name,100001,,\n'
    )

    expect(result.createdCount).toBe(0)
    expect(result.updatedCount).toBe(1)
    expect(profileState.get('100001')?.full_name).toBe('Updated Name')
    expect(profileState.get('100001')?.email).toBe('existing@alea.club')
    expect(profileState.get('100001')?.phone).toBe('600111222')
  })

  it('creates new imported members as inactive profiles with internal auth email', async () => {
    const { importMembersFromCsv } = await loadService()

    const result = await importMembersFromCsv(
      'USUARIOS,ID,email,phone\nNew Member,100020,new@alea.club,699000111\n'
    )

    expect(result.createdCount).toBe(1)
    expect(result.totalRows).toBe(1)
    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: '100020@members.alea.internal',
        email_confirm: true,
      })
    )
    expect(profileState.get('100020')).toEqual(
      expect.objectContaining({
        member_number: '100020',
        full_name: 'New Member',
        auth_email: '100020@members.alea.internal',
        email: 'new@alea.club',
        phone: '699000111',
        is_active: false,
        active_from: null,
        psw_changed: null,
      })
    )
  })
})
