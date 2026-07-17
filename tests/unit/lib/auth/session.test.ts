// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

/**
 * Smoke test for the lib/auth/session seam (F0-06).
 *
 * Unlike the sibling seams (lib/db, lib/storage/qr), this module does NOT
 * wrap the Supabase client *factories* — call sites still create their own
 * client via lib/supabase/server and pass it in. So there is nothing to
 * mock at the module level here; instead each test builds a minimal mock
 * client matching the shape this seam expects, and asserts the wrapper
 * calls the correct underlying `.auth`/`.auth.admin` method with the
 * correct arguments and preserves its result/error shape unchanged. This
 * locks in the wrapper-to-underlying-client mapping so a future refactor
 * cannot accidentally route an admin operation through the wrong method,
 * drop credentials, or change the existing auth-error semantics.
 */

describe('lib/auth/session seam', () => {
  describe('getAuthUser()', () => {
    it('returns the user when Supabase resolves an authenticated user with no error', async () => {
      const { getAuthUser } = await import('@/lib/auth/session')

      const user = { id: 'user-1' }
      const mockGetUser = vi.fn().mockResolvedValue({ data: { user }, error: null })
      const client = { auth: { getUser: mockGetUser } }

      const result = await getAuthUser(client)

      expect(mockGetUser).toHaveBeenCalledTimes(1)
      expect(result).toEqual(user)
    })

    it('returns null when Supabase returns an error', async () => {
      const { getAuthUser } = await import('@/lib/auth/session')

      const mockGetUser = vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: { message: 'invalid session' },
      })
      const client = { auth: { getUser: mockGetUser } }

      const result = await getAuthUser(client)

      expect(result).toBeNull()
    })

    it('returns null when there is no authenticated user', async () => {
      const { getAuthUser } = await import('@/lib/auth/session')

      const mockGetUser = vi.fn().mockResolvedValue({ data: { user: null }, error: null })
      const client = { auth: { getUser: mockGetUser } }

      const result = await getAuthUser(client)

      expect(result).toBeNull()
    })
  })

  describe('signInWithPassword()', () => {
    it('calls client.auth.signInWithPassword() with the given credentials and returns its result', async () => {
      const { signInWithPassword } = await import('@/lib/auth/session')

      const credentials = { email: 'member@example.com', password: 'secret' }
      const mockResult = { data: { user: { id: 'user-1' } }, error: null }
      const mockSignIn = vi.fn().mockResolvedValue(mockResult)
      const client = { auth: { signInWithPassword: mockSignIn } }

      const result = await signInWithPassword(client, credentials)

      expect(mockSignIn).toHaveBeenCalledWith(credentials)
      expect(result).toBe(mockResult)
    })

    it('preserves Supabase auth-error semantics on failed sign-in', async () => {
      const { signInWithPassword } = await import('@/lib/auth/session')

      const mockResult = { data: { user: null }, error: { message: 'Invalid login credentials' } }
      const mockSignIn = vi.fn().mockResolvedValue(mockResult)
      const client = { auth: { signInWithPassword: mockSignIn } }

      const result = await signInWithPassword(client, { email: 'member@example.com', password: 'wrong' })

      expect(result.error).toEqual({ message: 'Invalid login credentials' })
    })
  })

  describe('signOut()', () => {
    it('calls client.auth.signOut() and returns its result', async () => {
      const { signOut } = await import('@/lib/auth/session')

      const mockResult = { error: null }
      const mockSignOut = vi.fn().mockResolvedValue(mockResult)
      const client = { auth: { signOut: mockSignOut } }

      const result = await signOut(client)

      expect(mockSignOut).toHaveBeenCalledTimes(1)
      expect(result).toBe(mockResult)
    })

    it('propagates errors returned by client.auth.signOut()', async () => {
      const { signOut } = await import('@/lib/auth/session')

      const mockResult = { error: { message: 'sign-out failed' } }
      const mockSignOut = vi.fn().mockResolvedValue(mockResult)
      const client = { auth: { signOut: mockSignOut } }

      const result = await signOut(client)

      expect(result.error).toEqual({ message: 'sign-out failed' })
    })
  })

  describe('createAuthUser()', () => {
    it('calls admin.auth.admin.createUser() with the given input and returns its result', async () => {
      const { createAuthUser } = await import('@/lib/auth/session')

      const input = { email: 'new@example.com', password: 'secret', email_confirm: true }
      const mockResult = { data: { user: { id: 'user-2' } }, error: null }
      const mockCreateUser = vi.fn().mockResolvedValue(mockResult)
      const admin = { auth: { admin: { createUser: mockCreateUser, deleteUser: vi.fn(), updateUserById: vi.fn() } } }

      const result = await createAuthUser(admin, input)

      expect(mockCreateUser).toHaveBeenCalledWith(input)
      expect(result).toBe(mockResult)
    })
  })

  describe('deleteAuthUser()', () => {
    it('calls admin.auth.admin.deleteUser() with the given id and returns its result', async () => {
      const { deleteAuthUser } = await import('@/lib/auth/session')

      const mockResult = { error: null }
      const mockDeleteUser = vi.fn().mockResolvedValue(mockResult)
      const admin = { auth: { admin: { createUser: vi.fn(), deleteUser: mockDeleteUser, updateUserById: vi.fn() } } }

      const result = await deleteAuthUser(admin, 'user-2')

      expect(mockDeleteUser).toHaveBeenCalledWith('user-2')
      expect(result).toBe(mockResult)
    })
  })

  describe('updateAuthUserById()', () => {
    it('calls admin.auth.admin.updateUserById() with the given id and attributes and returns its result', async () => {
      const { updateAuthUserById } = await import('@/lib/auth/session')

      const attributes = { email: 'updated@example.com' }
      const mockResult = { error: null }
      const mockUpdateUserById = vi.fn().mockResolvedValue(mockResult)
      const admin = {
        auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn(), updateUserById: mockUpdateUserById } },
      }

      const result = await updateAuthUserById(admin, 'user-2', attributes)

      expect(mockUpdateUserById).toHaveBeenCalledWith('user-2', attributes)
      expect(result).toBe(mockResult)
    })

    it('propagates errors returned by admin.auth.admin.updateUserById()', async () => {
      const { updateAuthUserById } = await import('@/lib/auth/session')

      const mockResult = { error: { message: 'update failed' } }
      const mockUpdateUserById = vi.fn().mockResolvedValue(mockResult)
      const admin = {
        auth: { admin: { createUser: vi.fn(), deleteUser: vi.fn(), updateUserById: mockUpdateUserById } },
      }

      const result = await updateAuthUserById(admin, 'user-2', { password: 'new-secret' })

      expect(result.error).toEqual({ message: 'update failed' })
    })
  })
})
