// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  computeCutoverEpoch,
  isSessionValidAfterCutover,
  planSessionInvalidation,
} from '@/lib/cutover/session-invalidation.mjs'

describe('session-invalidation module — forced re-login post-cutover', () => {
  describe('computeCutoverEpoch function', () => {
    it('converts a Date to millisecond epoch', () => {
      const date = new Date('2026-07-16T14:30:00.000Z')
      const epoch = computeCutoverEpoch(date)
      expect(epoch).toBe(date.getTime())
    })

    it('handles a date with sub-millisecond precision (rounded down)', () => {
      const date = new Date('2026-07-16T14:30:00.456Z')
      const epoch = computeCutoverEpoch(date)
      expect(epoch).toBe(date.getTime())
      expect(epoch).toBe(1784212200456)
    })

    it('handles an epoch date (1970-01-01)', () => {
      const epoch = computeCutoverEpoch(new Date(0))
      expect(epoch).toBe(0)
    })

    it('handles a far-future date', () => {
      const date = new Date('2099-12-31T23:59:59.999Z')
      const epoch = computeCutoverEpoch(date)
      expect(typeof epoch).toBe('number')
      expect(epoch).toBeGreaterThan(0)
    })
  })

  describe('isSessionValidAfterCutover function', () => {
    const cutoverAt = new Date('2026-07-16T14:30:00.000Z')
    const cutoverEpochMs = cutoverAt.getTime()

    it('returns false for a session issued BEFORE cutover', () => {
      const sessionIssuedAtMs = cutoverEpochMs - 1000 // 1 second before
      expect(isSessionValidAfterCutover(sessionIssuedAtMs, cutoverEpochMs)).toBe(false)
    })

    it('returns false for a session issued 1 hour before cutover', () => {
      const sessionIssuedAtMs = cutoverEpochMs - 60 * 60 * 1000
      expect(isSessionValidAfterCutover(sessionIssuedAtMs, cutoverEpochMs)).toBe(false)
    })

    it('returns false for a session issued 1 day before cutover', () => {
      const sessionIssuedAtMs = cutoverEpochMs - 24 * 60 * 60 * 1000
      expect(isSessionValidAfterCutover(sessionIssuedAtMs, cutoverEpochMs)).toBe(false)
    })

    it('returns true for a session issued AT cutover boundary (inclusive)', () => {
      const sessionIssuedAtMs = cutoverEpochMs
      expect(isSessionValidAfterCutover(sessionIssuedAtMs, cutoverEpochMs)).toBe(true)
    })

    it('returns true for a session issued AFTER cutover', () => {
      const sessionIssuedAtMs = cutoverEpochMs + 1000 // 1 second after
      expect(isSessionValidAfterCutover(sessionIssuedAtMs, cutoverEpochMs)).toBe(true)
    })

    it('returns true for a session issued 1 second after cutover', () => {
      const sessionIssuedAtMs = cutoverEpochMs + 1000
      expect(isSessionValidAfterCutover(sessionIssuedAtMs, cutoverEpochMs)).toBe(true)
    })

    it('returns true for a session issued 1 minute after cutover', () => {
      const sessionIssuedAtMs = cutoverEpochMs + 60 * 1000
      expect(isSessionValidAfterCutover(sessionIssuedAtMs, cutoverEpochMs)).toBe(true)
    })

    it('has boundary at millisecond precision (not rounded down)', () => {
      // Test that the boundary is exactly at cutoverEpochMs, not rounded
      expect(isSessionValidAfterCutover(cutoverEpochMs - 1, cutoverEpochMs)).toBe(false)
      expect(isSessionValidAfterCutover(cutoverEpochMs, cutoverEpochMs)).toBe(true)
      expect(isSessionValidAfterCutover(cutoverEpochMs + 1, cutoverEpochMs)).toBe(true)
    })
  })

  describe('planSessionInvalidation function — core logic', () => {
    const cutoverAt = new Date('2026-07-16T14:30:00.000Z')
    const cutoverEpochMs = cutoverAt.getTime()

    it('invalidates a session issued 1 hour before cutover', () => {
      const sessions = [
        { userId: 'user-1', issuedAt: new Date(cutoverEpochMs - 60 * 60 * 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.invalidatedUserIds).toContain('user-1')
      expect(plan.stillValidUserIds).not.toContain('user-1')
    })

    it('invalidates a session issued 1 day before cutover', () => {
      const sessions = [
        { userId: 'user-old', issuedAt: new Date(cutoverEpochMs - 24 * 60 * 60 * 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.invalidatedUserIds).toContain('user-old')
      expect(plan.stillValidUserIds).not.toContain('user-old')
    })

    it('invalidates a session issued 1 second before cutover', () => {
      const sessions = [
        { userId: 'user-just-before', issuedAt: new Date(cutoverEpochMs - 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.invalidatedUserIds).toContain('user-just-before')
    })

    it('accepts a session issued AT the cutover boundary', () => {
      const sessions = [{ userId: 'user-boundary', issuedAt: cutoverAt }]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.stillValidUserIds).toContain('user-boundary')
      expect(plan.invalidatedUserIds).not.toContain('user-boundary')
    })

    it('accepts a session issued AFTER cutover', () => {
      const sessions = [
        { userId: 'user-fresh', issuedAt: new Date(cutoverEpochMs + 5 * 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.stillValidUserIds).toContain('user-fresh')
      expect(plan.invalidatedUserIds).not.toContain('user-fresh')
    })

    it('handles all pre-cutover sessions (entire batch invalidated)', () => {
      const sessions = [
        { userId: 'user-1', issuedAt: new Date(cutoverEpochMs - 60 * 60 * 1000) },
        { userId: 'user-2', issuedAt: new Date(cutoverEpochMs - 24 * 60 * 60 * 1000) },
        { userId: 'user-3', issuedAt: new Date(cutoverEpochMs - 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.invalidatedUserIds).toHaveLength(3)
      expect(plan.stillValidUserIds).toHaveLength(0)
    })

    it('handles a mixed batch: pre and post-cutover', () => {
      const sessions = [
        { userId: 'user-old-1', issuedAt: new Date(cutoverEpochMs - 60 * 60 * 1000) },
        { userId: 'user-old-2', issuedAt: new Date(cutoverEpochMs - 1000) },
        { userId: 'user-fresh-1', issuedAt: new Date(cutoverEpochMs + 5 * 1000) },
        { userId: 'user-fresh-2', issuedAt: new Date(cutoverEpochMs + 60 * 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.invalidatedUserIds).toHaveLength(2)
      expect(plan.stillValidUserIds).toHaveLength(2)
      expect(plan.invalidatedUserIds.sort()).toEqual(['user-old-1', 'user-old-2'].sort())
      expect(plan.stillValidUserIds.sort()).toEqual(['user-fresh-1', 'user-fresh-2'].sort())
    })

    it('handles an empty session list', () => {
      const plan = planSessionInvalidation([], cutoverAt)
      expect(plan.invalidatedUserIds).toHaveLength(0)
      expect(plan.stillValidUserIds).toHaveLength(0)
    })

    it('handles duplicate user IDs (both classified independently)', () => {
      const sessions = [
        { userId: 'user-1', issuedAt: new Date(cutoverEpochMs - 60 * 1000) },
        { userId: 'user-1', issuedAt: new Date(cutoverEpochMs + 60 * 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.invalidatedUserIds).toContain('user-1')
      expect(plan.stillValidUserIds).toContain('user-1')
    })

    it('includes cutoverEpochMs in the result for reference', () => {
      const sessions = [{ userId: 'user-1', issuedAt: cutoverAt }]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.cutoverEpochMs).toBe(cutoverEpochMs)
    })

    it('returns empty sets when all sessions are invalidated (forced single re-login)', () => {
      const sessions = [
        { userId: 'user-1', issuedAt: new Date(cutoverEpochMs - 1000) },
        { userId: 'user-2', issuedAt: new Date(cutoverEpochMs - 1000) },
      ]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.stillValidUserIds.length).toBe(0)
      expect(plan.invalidatedUserIds.length).toBe(2)
    })

    it('correctly handles sessions from years in the past', () => {
      const oldDate = new Date('2020-01-01T00:00:00.000Z')
      const sessions = [{ userId: 'very-old-user', issuedAt: oldDate }]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.invalidatedUserIds).toContain('very-old-user')
    })

    it('correctly handles sessions issued in the far future', () => {
      const futureDate = new Date('2099-12-31T23:59:59.999Z')
      const sessions = [{ userId: 'future-user', issuedAt: futureDate }]
      const plan = planSessionInvalidation(sessions, cutoverAt)
      expect(plan.stillValidUserIds).toContain('future-user')
    })
  })
})
