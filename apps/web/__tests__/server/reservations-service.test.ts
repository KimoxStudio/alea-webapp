import type { SessionUser } from '@/lib/server/auth'
import type { ServiceError } from '@/lib/server/service-error'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminSession: SessionUser = {
  id: '1',
  role: 'admin',
}

const memberSession: SessionUser = {
  id: '2',
  role: 'member',
}

async function loadReservationModules() {
  vi.resetModules()

  const service = await import('@/lib/server/reservations-service')
  const db = await import('@/lib/server/mock-db')

  return { ...service, ...db }
}

describe('updateReservationForSession', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('treats null status as absent', async () => {
    const { updateReservationForSession } = await loadReservationModules()

    const updated = updateReservationForSession(memberSession, 'r1', { status: null })

    expect(updated.status).toBe('active')
  })

  it('treats null date and times as absent while applying explicit updates', async () => {
    const { findReservationById, updateReservationForSession } = await loadReservationModules()
    const existing = findReservationById('r1')

    expect(existing).not.toBeNull()

    const updated = updateReservationForSession(memberSession, 'r1', {
      date: null,
      startTime: null,
      endTime: null,
      status: null,
      surface: null,
    })

    expect(updated.date).toBe(existing!.date)
    expect(updated.startTime).toBe(existing!.startTime)
    expect(updated.endTime).toBe(existing!.endTime)
    expect(updated.status).toBe(existing!.status)
  })

  it('updates explicitly provided non-null fields', async () => {
    const { updateReservationForSession } = await loadReservationModules()

    const updated = updateReservationForSession(memberSession, 'r1', {
      status: null,
      startTime: '18:00',
      endTime: '19:00',
    })

    expect(updated.status).toBe('active')
    expect(updated.startTime).toBe('18:00')
    expect(updated.endTime).toBe('19:00')
  })

  it('surface stays null when body.surface is null (not converted to undefined)', async () => {
    const { updateReservationForSession } = await loadReservationModules()
    // r1 seed has no surface — the service normalises absent surface to null via `?? null`
    const updated = updateReservationForSession(memberSession, 'r1', { surface: null })

    // surface must be null, not undefined — the null-as-absent patch must be preserved
    expect(updated.surface).toBeNull()
  })

  it('surface stays null when body.surface is undefined (not converted to undefined)', async () => {
    const { updateReservationForSession } = await loadReservationModules()
    // r1 seed has no surface — the service normalises absent surface to null via `?? null`
    const updated = updateReservationForSession(memberSession, 'r1', { surface: undefined })

    // surface must be null, not undefined — the absent patch must be preserved as null
    expect(updated.surface).toBeNull()
  })
})

describe('checkReservationAccess', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('throws ServiceError with 404 when reservation is not found', async () => {
    const { checkReservationAccess } = await loadReservationModules()

    let caught: ServiceError | undefined
    try {
      checkReservationAccess(memberSession, 'non-existent-id')
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.name).toBe('ServiceError')
    expect(caught?.statusCode).toBe(404)
  })

  it('throws ServiceError with 403 when member accesses another member reservation', async () => {
    const { checkReservationAccess } = await loadReservationModules()
    // r1 and r2 belong to user '2'; create a session for a different member
    const otherMember: SessionUser = { id: '999', role: 'member' }

    let caught: ServiceError | undefined
    try {
      checkReservationAccess(otherMember, 'r1')
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.name).toBe('ServiceError')
    expect(caught?.statusCode).toBe(403)
  })

  it('does not throw when member accesses own reservation', async () => {
    const { checkReservationAccess } = await loadReservationModules()
    // r1 belongs to user '2' (memberSession)
    await expect(() => checkReservationAccess(memberSession, 'r1')).not.toThrow()
  })

  it('does not throw when admin accesses any reservation', async () => {
    const { checkReservationAccess } = await loadReservationModules()
    // r1 belongs to user '2', but admin can access it
    await expect(() => checkReservationAccess(adminSession, 'r1')).not.toThrow()
  })
})
