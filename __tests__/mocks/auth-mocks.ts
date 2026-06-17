import { vi } from 'vitest'
import { NextResponse } from 'next/server'
import type { SessionUser } from '@/lib/server/auth'

/**
 * Shared mock builders for route tests
 *
 * These helpers standardize the mocking patterns for common auth and security functions
 * used across route handler tests.
 */

/**
 * Default authenticated member session
 */
const defaultAuthenticatedSession: SessionUser = {
  id: 'user-default',
  role: 'member',
}

/**
 * Default admin session user
 */
const defaultAdminSession: SessionUser = {
  id: 'admin-default',
  role: 'admin',
}

/**
 * Create a mock context object for route handlers (returned by requireAuth/requireAdmin)
 */
function createMockContext(session: SessionUser) {
  return {
    session,
    applyCookies: (res: NextResponse) => res,
  }
}

/**
 * Create a mock for requireAuth that resolves with an authenticated session
 *
 * Usage:
 * ```
 * const requireAuthMock = mockRequireAuth({ id: 'user-123', role: 'member' })
 * vi.mock('@/lib/server/auth', () => ({ requireAuth: requireAuthMock }))
 * ```
 */
export function mockRequireAuth(session?: Partial<SessionUser>) {
  const finalSession = { ...defaultAuthenticatedSession, ...session }
  return vi.fn(async () => createMockContext(finalSession))
}

/**
 * Create a mock for requireAdmin that resolves with an admin session
 *
 * Usage:
 * ```
 * const requireAdminMock = mockRequireAdmin({ id: 'admin-456' })
 * vi.mock('@/lib/server/auth', () => ({ requireAdmin: requireAdminMock }))
 * ```
 */
export function mockRequireAdmin(session?: Partial<SessionUser>) {
  const finalSession = { ...defaultAdminSession, ...session }
  return vi.fn(async () => createMockContext(finalSession))
}

/**
 * Create a mock for enforceMutationSecurity that passes (returns null/undefined)
 *
 * Usage:
 * ```
 * const enforceMutationSecurityMock = mockEnforceMutationSecurity()
 * vi.mock('@/lib/server/security', () => ({
 *   enforceMutationSecurity: enforceMutationSecurityMock
 * }))
 * ```
 */
export function mockEnforceMutationSecurity() {
  return vi.fn(async () => null)
}

/**
 * Create a mock for enforceRateLimit that passes (returns null/undefined)
 *
 * Usage:
 * ```
 * const enforceRateLimitMock = mockEnforceRateLimit()
 * vi.mock('@/lib/server/security', () => ({
 *   enforceRateLimit: enforceRateLimitMock
 * }))
 * ```
 */
export function mockEnforceRateLimit() {
  return vi.fn(async () => null)
}
