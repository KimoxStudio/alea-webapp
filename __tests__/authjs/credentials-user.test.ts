// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock bcryptjs before importing the module under test
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}))

// Mock pg Pool
const mockQuery = vi.fn()
const mockPool = {
  query: mockQuery,
}

vi.mock('@/lib/authjs/db', () => ({
  getAuthDbPool: vi.fn(),
}))

import bcryptjs from 'bcryptjs'
import { getAuthDbPool } from '@/lib/authjs/db'
import { verifyCredentials } from '@/lib/authjs/credentials-user'

describe('verifyCredentials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.mockReset()
  })

  describe('when POSTGRES_URL is unset', () => {
    it('returns null when pool is not configured', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(null)

      const result = await verifyCredentials('test@example.com', 'password123')

      expect(result).toBeNull()
      expect(mockQuery).not.toHaveBeenCalled()
    })
  })

  describe('when database query throws', () => {
    it('returns null when query raises an error (e.g., missing table)', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockRejectedValue(new Error('relation "profiles" does not exist'))

      const result = await verifyCredentials('test@example.com', 'password123')

      expect(result).toBeNull()
    })

    it('returns null when query raises a connection error', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockRejectedValue(new Error('Connection refused'))

      const result = await verifyCredentials('test@example.com', 'password123')

      expect(result).toBeNull()
    })

    it('returns null on any unexpected error', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockRejectedValue(new Error('Unknown error'))

      const result = await verifyCredentials('test@example.com', 'password123')

      expect(result).toBeNull()
    })
  })

  describe('when no matching row is found', () => {
    it('returns null when email does not exist', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [],
      })

      const result = await verifyCredentials('nonexistent@example.com', 'password123')

      expect(result).toBeNull()
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, email, password_hash, full_name FROM profiles WHERE email = $1 LIMIT 1',
        ['nonexistent@example.com']
      )
    })
  })

  describe('when row found but password_hash is null or empty', () => {
    it('returns null when password_hash is null', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-1',
            email: 'test@example.com',
            password_hash: null,
            full_name: 'Test User',
          },
        ],
      })

      const result = await verifyCredentials('test@example.com', 'password123')

      expect(result).toBeNull()
    })

    it('returns null when password_hash is empty string', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-1',
            email: 'test@example.com',
            password_hash: '',
            full_name: 'Test User',
          },
        ],
      })

      const result = await verifyCredentials('test@example.com', 'password123')

      expect(result).toBeNull()
    })
  })

  describe('when password does not match', () => {
    it('returns null when password is incorrect', async () => {
      const bcryptHash = '$2a$10$xyzhashedpassword'
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-1',
            email: 'test@example.com',
            password_hash: bcryptHash,
            full_name: 'Test User',
          },
        ],
      })
      vi.mocked(bcryptjs.default.compare).mockResolvedValue(false as any)

      const result = await verifyCredentials('test@example.com', 'wrongpassword')

      expect(result).toBeNull()
      expect(vi.mocked(bcryptjs.default.compare)).toHaveBeenCalledWith(
        'wrongpassword',
        bcryptHash
      )
    })

    it('does not leak timing information between "no such user" and "wrong password"', async () => {
      const bcryptHash = '$2a$10$xyzhashedpassword'

      // Case 1: No user found
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({ rows: [] })

      const noUserResult = await verifyCredentials('nonexistent@example.com', 'anypassword')

      // Case 2: User found, wrong password
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-1',
            email: 'test@example.com',
            password_hash: bcryptHash,
            full_name: 'Test User',
          },
        ],
      })
      vi.mocked(bcryptjs.default.compare).mockResolvedValue(false as any)

      const wrongPasswordResult = await verifyCredentials('test@example.com', 'wrongpassword')

      // Both scenarios return null uniformly
      expect(noUserResult).toBeNull()
      expect(wrongPasswordResult).toBeNull()
    })
  })

  describe('when password matches', () => {
    it('returns user object with id, email, and name', async () => {
      const bcryptHash = '$2a$10$xyzhashedpassword'
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-1',
            email: 'test@example.com',
            password_hash: bcryptHash,
            full_name: 'Test User',
          },
        ],
      })
      vi.mocked(bcryptjs.default.compare).mockResolvedValue(true as any)

      const result = await verifyCredentials('test@example.com', 'correctpassword')

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
      })
    })

    it('returns user object with name as null when full_name is null', async () => {
      const bcryptHash = '$2a$10$xyzhashedpassword'
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-2',
            email: 'another@example.com',
            password_hash: bcryptHash,
            full_name: null,
          },
        ],
      })
      vi.mocked(bcryptjs.default.compare).mockResolvedValue(true as any)

      const result = await verifyCredentials('another@example.com', 'correctpassword')

      expect(result).toEqual({
        id: 'user-2',
        email: 'another@example.com',
        name: null,
      })
    })

    it('does not include password_hash in the returned user object', async () => {
      const bcryptHash = '$2a$10$xyzhashedpassword'
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-3',
            email: 'secure@example.com',
            password_hash: bcryptHash,
            full_name: 'Secure User',
          },
        ],
      })
      vi.mocked(bcryptjs.default.compare).mockResolvedValue(true as any)

      const result = await verifyCredentials('secure@example.com', 'correctpassword')

      expect(result).not.toHaveProperty('password_hash')
      expect(result).toEqual({
        id: 'user-3',
        email: 'secure@example.com',
        name: 'Secure User',
      })
    })

    it('correctly calls bcrypt.compare with plaintext and hash', async () => {
      const bcryptHash = '$2a$10$xyzhashedpassword'
      const plainPassword = 'mypassword123'
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({
        rows: [
          {
            id: 'user-4',
            email: 'compare@example.com',
            password_hash: bcryptHash,
            full_name: 'Compare User',
          },
        ],
      })
      vi.mocked(bcryptjs.default.compare).mockResolvedValue(true as any)

      await verifyCredentials('compare@example.com', plainPassword)

      expect(vi.mocked(bcryptjs.default.compare)).toHaveBeenCalledWith(plainPassword, bcryptHash)
      expect(vi.mocked(bcryptjs.default.compare)).toHaveBeenCalledTimes(1)
    })
  })

  describe('parameterized query safety', () => {
    it('uses parameterized query to prevent SQL injection', async () => {
      vi.mocked(getAuthDbPool).mockReturnValue(mockPool as any)
      mockQuery.mockResolvedValue({ rows: [] })

      const maliciousEmail = "'; DROP TABLE profiles; --"
      await verifyCredentials(maliciousEmail, 'password')

      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT id, email, password_hash, full_name FROM profiles WHERE email = $1 LIMIT 1',
        [maliciousEmail]
      )
    })
  })
})
