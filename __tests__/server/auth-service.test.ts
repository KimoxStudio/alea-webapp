import { beforeEach, describe, expect, it, vi } from 'vitest'

type ProfileRow = {
  id: string
  member_number: string
  email: string
  role: 'member' | 'admin'
  is_active: boolean
  created_at: string
  updated_at: string
}

const adminState = {
  byEmail: new Map<string, ProfileRow>(),
  byMemberNumber: new Map<string, ProfileRow>(),
  byId: new Map<string, ProfileRow>(),
}

const signInWithPassword = vi.fn()
const signOut = vi.fn()
const sessionScopedProfileMaybeSingle = vi.fn()
const adminCreateUser = vi.fn()
const adminDeleteUser = vi.fn()
const adminUpdateProfileSelectMaybeSingle = vi.fn()
const adminUpdateProfileEq = vi.fn()

function makeProfile(overrides?: Partial<ProfileRow>): ProfileRow {
  return {
    id: 'user-1',
    member_number: '100001',
    email: 'admin@alea.club',
    role: 'admin',
    is_active: true,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: {
      signInWithPassword,
      signOut,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: string) => ({
          maybeSingle: vi.fn(async () => {
            sessionScopedProfileMaybeSingle(column, value)
            if (column === 'id') {
              return { data: adminState.byId.get(value) ?? null, error: null }
            }
            return { data: null, error: null }
          }),
        })),
      })),
    })),
  })),
  createSupabaseServerAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: adminCreateUser,
        deleteUser: adminDeleteUser,
      },
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((column: string, value: string) => ({
          maybeSingle: vi.fn(async () => {
            if (column === 'email') {
              return { data: adminState.byEmail.get(value) ?? null, error: null }
            }
            if (column === 'member_number') {
              return { data: adminState.byMemberNumber.get(value) ?? null, error: null }
            }
            if (column === 'id') {
              return { data: adminState.byId.get(value) ?? null, error: null }
            }
            return { data: null, error: null }
          }),
        })),
      })),
      update: vi.fn(() => ({
        eq: adminUpdateProfileEq,
      })),
    })),
  })),
}))

async function loadService() {
  return import('@/lib/server/auth-service')
}

describe('auth service', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    adminState.byEmail.clear()
    adminState.byMemberNumber.clear()
    adminState.byId.clear()
    signInWithPassword.mockImplementation(async ({ email }: { email: string }) => {
      const profile = adminState.byEmail.get(email)
      if (!profile) return { data: { user: null }, error: { message: 'Invalid credentials' } }
      return { data: { user: { id: profile.id } }, error: null }
    })
    signOut.mockResolvedValue({ error: null })
    sessionScopedProfileMaybeSingle.mockReset()
    adminCreateUser.mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null })
    adminDeleteUser.mockResolvedValue({ error: null })
    adminUpdateProfileSelectMaybeSingle.mockResolvedValue({
      data: {
        id: 'new-user-id',
        member_number: '100099',
        role: 'member',
        is_active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      error: null,
    })
    adminUpdateProfileEq.mockReturnValue({
      select: vi.fn(() => ({
        maybeSingle: adminUpdateProfileSelectMaybeSingle,
      })),
    })

    const admin = makeProfile()
    const member = makeProfile({
      id: 'user-2',
      member_number: '100002',
      email: 'socio@alea.club',
      role: 'member',
    })
    adminState.byEmail.set(admin.email, admin)
    adminState.byMemberNumber.set(admin.member_number, admin)
    adminState.byId.set(admin.id, admin)
    adminState.byEmail.set(member.email, member)
    adminState.byMemberNumber.set(member.member_number, member)
    adminState.byId.set(member.id, member)
  })

  describe('login', () => {
    it('returns the public user for a valid member number / password pair', async () => {
      const { login } = await loadService()

      await expect(
        login({ identifier: '100001', password: 'Admin1234!@#' }),
      ).resolves.toMatchObject({
        id: 'user-1',
        role: 'admin',
        memberNumber: '100001',
      })
    })

    it('resolves the member number to the Supabase Auth email before signing in', async () => {
      const { login } = await loadService()

      await expect(
        login({ identifier: '100002', password: 'Socio1234!@#' }),
      ).resolves.toMatchObject({
        id: 'user-2',
      })
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'socio@alea.club',
        password: 'Socio1234!@#',
      })
    })

    it('rejects missing credentials with a 400 ServiceError', async () => {
      const { login } = await loadService()

      await expect(login({ identifier: '100001' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
      })
    })

    it('rejects an unknown member number with a 401 ServiceError', async () => {
      const { login } = await loadService()

      await expect(
        login({ identifier: '999999', password: 'Admin1234!@#' }),
      ).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 401,
      })
    })

    it('rejects invalid credentials when Supabase sign-in fails', async () => {
      const { login } = await loadService()
      signInWithPassword.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      })

      await expect(
        login({ identifier: '100001', password: 'wrong-password' }),
      ).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 401,
      })
    })

    it('rejects a suspended user (is_active: false) with a 401 ServiceError before signing in', async () => {
      const { login } = await loadService()
      const suspended = makeProfile({
        id: 'user-3',
        member_number: '100003',
        email: 'suspended@alea.club',
        role: 'member',
        is_active: false,
      })
      adminState.byMemberNumber.set(suspended.member_number, suspended)
      adminState.byEmail.set(suspended.email, suspended)
      adminState.byId.set(suspended.id, suspended)

      await expect(
        login({ identifier: '100003', password: 'Password1234!@#' }),
      ).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 401,
        message: 'Invalid credentials',
      })
      expect(signInWithPassword).not.toHaveBeenCalled()
    })
  })

  describe('register', () => {
    it('creates a Supabase Auth user, updates the trigger-created profile row, and returns the public user', async () => {
      const { register } = await loadService()
      const sessionClient = { auth: { signInWithPassword, signOut } }

      const result = await register({ memberNumber: '100099', password: 'Password1234!@#' }, sessionClient)

      expect(adminCreateUser).toHaveBeenCalledWith({
        email: '100099@members.alea.internal',
        password: 'Password1234!@#',
        email_confirm: true,
      })
      expect(result).toMatchObject({
        id: 'new-user-id',
        memberNumber: '100099',
        role: 'member',
        isActive: true,
      })
    })

    it('calls signInWithPassword after creating the profile to establish a session', async () => {
      const { register } = await loadService()
      const sessionClient = { auth: { signInWithPassword, signOut } }

      await register({ memberNumber: '100099', password: 'Password1234!@#' }, sessionClient)

      expect(signInWithPassword).toHaveBeenCalledWith({
        email: '100099@members.alea.internal',
        password: 'Password1234!@#',
      })
    })

    it('rejects with 400 when the member number is already taken', async () => {
      const { register } = await loadService()

      // member number '100001' is already in adminState
      await expect(register({ memberNumber: '100001', password: 'Password1234!@#' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
        message: 'Invalid registration details',
      })
      expect(adminCreateUser).not.toHaveBeenCalled()
    })

    it('rejects with 400 when member number is missing', async () => {
      const { register } = await loadService()

      await expect(register({ password: 'Password1234!@#' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
      })
    })

    it('rejects with 400 when member number exceeds 20 characters', async () => {
      const { register } = await loadService()

      await expect(
        register({ memberNumber: '1'.repeat(21), password: 'Password1234!@#' }),
      ).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
      })
    })

    it('rejects with 400 when member number contains non-numeric characters', async () => {
      const { register } = await loadService()

      await expect(
        register({ memberNumber: 'ABC123', password: 'Password1234!@#' }),
      ).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
      })
    })

    it('rejects with 400 when password is missing', async () => {
      const { register } = await loadService()

      await expect(register({ memberNumber: '100099' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
      })
    })

    it('rejects with 500 when Supabase Auth user creation fails', async () => {
      const { register } = await loadService()
      adminCreateUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Auth creation failed' },
      })

      await expect(register({ memberNumber: '100099', password: 'Password1234!@#' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 500,
      })
    })

    it('cleans up the auth user and rejects with 400 when profile update hits a unique constraint', async () => {
      const { register } = await loadService()
      adminUpdateProfileSelectMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      })

      await expect(register({ memberNumber: '100099', password: 'Password1234!@#' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 400,
        message: 'Invalid registration details',
      })
      expect(adminDeleteUser).toHaveBeenCalledWith('new-user-id')
    })

    it('cleans up the auth user and rejects with 500 when the profile update fails', async () => {
      const { register } = await loadService()
      adminUpdateProfileSelectMaybeSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST', message: 'unexpected error' },
      })

      await expect(register({ memberNumber: '100099', password: 'Password1234!@#' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 500,
      })
      expect(adminDeleteUser).toHaveBeenCalledWith('new-user-id')
    })

    it('succeeds even when auto-login after registration fails', async () => {
      const { register } = await loadService()
      const failingSignIn = vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'sign in failed' },
      })
      const sessionClient = { auth: { signInWithPassword: failingSignIn, signOut } }

      const result = await register({ memberNumber: '100099', password: 'Password1234!@#' }, sessionClient)

      expect(result).toMatchObject({ id: 'new-user-id', memberNumber: '100099' })
    })
  })

  describe('getCurrentUser', () => {
    it('rejects when no session is present', async () => {
      const { getCurrentUser } = await loadService()

      await expect(getCurrentUser(null)).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 401,
      })
    })

    it('rejects when the session user profile is missing', async () => {
      const { getCurrentUser } = await loadService()

      await expect(getCurrentUser({ id: 'missing-user', role: 'member' })).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 401,
      })
    })

    it('reads the current profile through the session-scoped client instead of the admin client', async () => {
      const { getCurrentUser } = await loadService()

      await expect(getCurrentUser({ id: 'user-2', role: 'member' })).resolves.toMatchObject({
        id: 'user-2',
        role: 'member',
      })
      expect(sessionScopedProfileMaybeSingle).toHaveBeenCalledWith('id', 'user-2')
    })
  })

  describe('logout', () => {
    it('returns success when the server client signs out cleanly', async () => {
      const { logout } = await loadService()

      await expect(logout()).resolves.toEqual({ success: true })
    })

    it('maps sign-out failures to a 500 ServiceError', async () => {
      const { logout } = await loadService()
      signOut.mockResolvedValueOnce({ error: { message: 'sign-out failed' } })

      await expect(logout()).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 500,
      })
    })

    it('maps route-handler sign-out failures to a 500 ServiceError', async () => {
      const { logoutWithClient } = await loadService()

      await expect(
        logoutWithClient({
          auth: {
            signInWithPassword,
            signOut: vi.fn(async () => ({ error: { message: 'sign-out failed' } })),
          },
        }),
      ).rejects.toMatchObject({
        name: 'ServiceError',
        statusCode: 500,
      })
    })
  })
})
