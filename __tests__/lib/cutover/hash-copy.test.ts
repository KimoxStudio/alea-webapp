// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isBcryptHash, planPasswordHashCopy, assertByteForByteCopy, BCRYPT_HASH_RE } from '@/lib/cutover/hash-copy.mjs'

describe('hash-copy module — bcrypt validation & verbatim copy', () => {
  describe('BCRYPT_HASH_RE regex', () => {
    it('matches standard bcrypt \$2a\$ format (cost 10)', () => {
      const hash = '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(true)
    })

    it('matches \$2b\$ variant (bcryptjs default)', () => {
      const hash = '\$2b\$12\$R9h/cIPz0gi.URNN3kh2OPST9/PgBkqquzi8Ss8KKUgQW4LWv9xI2'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(true)
    })

    it('matches \$2y\$ variant (old PHP bcrypt format)', () => {
      const hash = '\$2y\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(true)
    })

    it('rejects wrong version tag (e.g. \$2c\$)', () => {
      const hash = '\$2c\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(false)
    })

    it('rejects single-digit cost factor', () => {
      const hash = '\$2a\$1\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(false)
    })

    it('rejects triple-digit cost factor', () => {
      const hash = '\$2a\$100\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(false)
    })

    it('rejects truncated salt+digest (too short)', () => {
      const hash = '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(false)
    })

    it('rejects extended salt+digest (too long)', () => {
      const hash = '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWyXXX'
      expect(BCRYPT_HASH_RE.test(hash)).toBe(false)
    })
  })

  describe('isBcryptHash function', () => {
    it('accepts a valid bcrypt hash string', () => {
      const hash = '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
      expect(isBcryptHash(hash)).toBe(true)
    })

    it('rejects non-string values', () => {
      expect(isBcryptHash(null)).toBe(false)
      expect(isBcryptHash(undefined)).toBe(false)
      expect(isBcryptHash(123)).toBe(false)
      expect(isBcryptHash({})).toBe(false)
      expect(isBcryptHash([])).toBe(false)
    })

    it('rejects malformed hash strings', () => {
      expect(isBcryptHash('not-a-hash')).toBe(false)
      expect(isBcryptHash('\$1\$rounds=4096\$...')).toBe(false)
      expect(isBcryptHash('')).toBe(false)
    })
  })

  describe('planPasswordHashCopy function — core copy logic', () => {
    const VALID_HASH = '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

    it('copies a row with a valid bcrypt hash', () => {
      const rows = [{ id: 'user-1', encryptedPassword: VALID_HASH }]
      const plan = planPasswordHashCopy(rows)
      expect(plan.copied).toHaveLength(1)
      expect(plan.copied[0]).toEqual({ id: 'user-1', passwordHash: VALID_HASH })
    })

    it('never re-hashes — copied value is BYTE-FOR-BYTE identical to source', () => {
      const rows = [{ id: 'user-1', encryptedPassword: VALID_HASH }]
      const plan = planPasswordHashCopy(rows)
      expect(plan.copied[0]?.passwordHash).toBe(VALID_HASH)
    })

    it('skips a row with null encryptedPassword', () => {
      const rows = [{ id: 'user-invited', encryptedPassword: null }]
      const plan = planPasswordHashCopy(rows)
      expect(plan.copied).toHaveLength(0)
      expect(plan.skipped).toHaveLength(1)
      expect(plan.skipped[0]).toEqual({ id: 'user-invited', reason: 'missing_encrypted_password' })
    })

    it('skips a row with undefined encryptedPassword', () => {
      const rows = [{ id: 'user-2', encryptedPassword: undefined }]
      const plan = planPasswordHashCopy(rows)
      expect(plan.skipped).toHaveLength(1)
      expect(plan.skipped[0]?.reason).toBe('missing_encrypted_password')
    })

    it('skips a row with empty-string encryptedPassword', () => {
      const rows = [{ id: 'user-3', encryptedPassword: '' }]
      const plan = planPasswordHashCopy(rows)
      expect(plan.skipped).toHaveLength(1)
      expect(plan.skipped[0]?.reason).toBe('missing_encrypted_password')
    })

    it('skips a row with non-bcrypt-format hash', () => {
      const rows = [{ id: 'user-4', encryptedPassword: 'plaintext-password' }]
      const plan = planPasswordHashCopy(rows)
      expect(plan.copied).toHaveLength(0)
      expect(plan.skipped).toHaveLength(1)
      expect(plan.skipped[0]).toEqual({ id: 'user-4', reason: 'not_bcrypt_format' })
    })

    it('handles a mixed batch: some valid, some skipped', () => {
      const rows = [
        { id: 'user-1', encryptedPassword: VALID_HASH },
        { id: 'user-2', encryptedPassword: null },
        { id: 'user-3', encryptedPassword: 'invalid-format' },
        { id: 'user-4', encryptedPassword: '\$2b\$12\$R9h/cIPz0gi.URNN3kh2OPST9/PgBkqquzi8Ss8KKUgQW4LWv9xI2' },
      ]
      const plan = planPasswordHashCopy(rows)
      expect(plan.copied).toHaveLength(2)
      expect(plan.skipped).toHaveLength(2)
    })

    it('handles an empty row list', () => {
      const plan = planPasswordHashCopy([])
      expect(plan.copied).toHaveLength(0)
      expect(plan.skipped).toHaveLength(0)
    })
  })

  describe('assertByteForByteCopy function — defensive verification', () => {
    const VALID_HASH = '\$2a\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

    it('passes when source and copied hashes are identical', () => {
      expect(() => {
        assertByteForByteCopy(VALID_HASH, VALID_HASH)
      }).not.toThrow()
    })

    it('throws when hashes differ', () => {
      expect(() => {
        assertByteForByteCopy(VALID_HASH, '\$2b\$12\$R9h/cIPz0gi.URNN3kh2OPST9/PgBkqquzi8Ss8KKUgQW4LWv9xI2')
      }).toThrow('hash-copy: copied value diverged from source')
    })

    it('throws when copied has a typo', () => {
      const mutated = VALID_HASH.slice(0, -1) + 'X'
      expect(() => {
        assertByteForByteCopy(VALID_HASH, mutated)
      }).toThrow()
    })

    it('throws when copied is truncated', () => {
      const truncated = VALID_HASH.slice(0, -5)
      expect(() => {
        assertByteForByteCopy(VALID_HASH, truncated)
      }).toThrow()
    })

    it('throws when copied is extended', () => {
      const extended = VALID_HASH + 'extra'
      expect(() => {
        assertByteForByteCopy(VALID_HASH, extended)
      }).toThrow()
    })

    it('error message explains the safety property', () => {
      try {
        assertByteForByteCopy(VALID_HASH, 'different')
      } catch (e) {
        // @ts-expect-error e is unknown
        expect(e.message).toMatch(/verbatim copy/)
        expect(e.message).toMatch(/never a re-hash/)
      }
    })
  })
})
