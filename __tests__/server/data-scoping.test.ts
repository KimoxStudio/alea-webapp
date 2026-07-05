// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { SessionUser } from '@/lib/server/auth'
import { assertMemberRowsScoped } from '@/lib/server/data-scoping'

type ScopedRow = { user_id: string; id?: string }

describe('data-scoping: assertMemberRowsScoped', () => {
  describe('admin sessions', () => {
    const adminSession: SessionUser = { id: 'admin-1', role: 'admin' }

    it('returns all rows including mixed/foreign user_ids', () => {
      const rows: ScopedRow[] = [
        { id: 'row-1', user_id: 'user-a' },
        { id: 'row-2', user_id: 'user-b' },
        { id: 'row-3', user_id: 'user-c' },
      ]

      const result = assertMemberRowsScoped(rows, adminSession)

      expect(result).toEqual(rows)
    })

    it('returns all rows when all have same foreign user_id', () => {
      const rows: ScopedRow[] = [
        { id: 'row-1', user_id: 'user-x' },
        { id: 'row-2', user_id: 'user-x' },
      ]

      const result = assertMemberRowsScoped(rows, adminSession)

      expect(result).toEqual(rows)
    })

    it('returns empty array without error', () => {
      const rows: ScopedRow[] = []

      const result = assertMemberRowsScoped(rows, adminSession)

      expect(result).toEqual([])
    })
  })

  describe('member sessions', () => {
    const memberSession: SessionUser = { id: 'user-123', role: 'member' }

    it('returns rows when all belong to the member', () => {
      const rows: ScopedRow[] = [
        { id: 'row-1', user_id: 'user-123' },
        { id: 'row-2', user_id: 'user-123' },
        { id: 'row-3', user_id: 'user-123' },
      ]

      const result = assertMemberRowsScoped(rows, memberSession)

      expect(result).toEqual(rows)
    })

    it('returns empty array without error', () => {
      const rows: ScopedRow[] = []

      const result = assertMemberRowsScoped(rows, memberSession)

      expect(result).toEqual([])
    })

    it('throws ServiceError with exact message when one row has foreign user_id', () => {
      const rows: ScopedRow[] = [
        { id: 'row-1', user_id: 'user-123' },
        { id: 'row-2', user_id: 'other-user' },
      ]

      expect(() => assertMemberRowsScoped(rows, memberSession)).toThrow(
        'Data isolation violation: member read returned foreign rows',
      )
    })

    it('throws ServiceError with statusCode 500 when any row has foreign user_id', () => {
      const rows: ScopedRow[] = [
        { id: 'row-1', user_id: 'user-123' },
        { id: 'row-2', user_id: 'other-user' },
      ]

      try {
        assertMemberRowsScoped(rows, memberSession)
        expect.fail('Should have thrown')
      } catch (error: unknown) {
        expect(error).toMatchObject({
          message: 'Data isolation violation: member read returned foreign rows',
          statusCode: 500,
        })
      }
    })

    it('throws when all rows are foreign (data leak scenario)', () => {
      const rows: ScopedRow[] = [
        { id: 'row-1', user_id: 'attacker-id' },
        { id: 'row-2', user_id: 'attacker-id' },
      ]

      expect(() => assertMemberRowsScoped(rows, memberSession)).toThrow(
        'Data isolation violation: member read returned foreign rows',
      )
    })
  })

  describe('edge cases', () => {
    it('works with rows that have additional fields beyond user_id', () => {
      const memberSession: SessionUser = { id: 'user-123', role: 'member' }
      const rows: (ScopedRow & { name?: string; status?: string })[] = [
        { id: 'row-1', user_id: 'user-123', name: 'Test', status: 'active' },
        { id: 'row-2', user_id: 'user-123', name: 'Another', status: 'pending' },
      ]

      const result = assertMemberRowsScoped(rows, memberSession)

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('name', 'Test')
      expect(result[1]).toHaveProperty('name', 'Another')
    })

    it('detects foreign rows with additional fields', () => {
      const memberSession: SessionUser = { id: 'user-123', role: 'member' }
      const rows: (ScopedRow & { name?: string })[] = [
        { id: 'row-1', user_id: 'user-123', name: 'Safe' },
        { id: 'row-2', user_id: 'user-456', name: 'Leaked' },
      ]

      expect(() => assertMemberRowsScoped(rows, memberSession)).toThrow(
        'Data isolation violation: member read returned foreign rows',
      )
    })
  })
})
