import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceError } from '@/lib/server/service-error'

async function loadAuthModules() {
  vi.resetModules()

  const service = await import('@/lib/server/auth-service')

  return { ...service }
}

describe('login', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns user object with id, role, email for valid credentials', async () => {
    const { login } = await loadAuthModules()

    const user = login({ identifier: 'admin@alea.club', password: 'Admin1234!@#' })

    expect(user).toBeDefined()
    expect(user.id).toBe('1')
    expect(user.role).toBe('admin')
    expect(user.email).toBe('admin@alea.club')
  })

  it('returns user when logging in with memberNumber', async () => {
    const { login } = await loadAuthModules()

    const user = login({ identifier: '100002', password: 'Socio1234!@#' })

    expect(user).toBeDefined()
    expect(user.id).toBe('2')
  })

  it('throws ServiceError for wrong password', async () => {
    const { login } = await loadAuthModules()

    let caught: ServiceError | undefined
    try {
      login({ identifier: 'admin@alea.club', password: 'WrongPassword!' })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.name).toBe('ServiceError')
    expect([400, 401]).toContain(caught?.statusCode)
  })

  it('throws ServiceError for unknown identifier', async () => {
    const { login } = await loadAuthModules()

    let caught: ServiceError | undefined
    try {
      login({ identifier: 'nobody@alea.club', password: 'Admin1234!@#' })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.name).toBe('ServiceError')
    expect([400, 401]).toContain(caught?.statusCode)
  })

  it('throws ServiceError with status 400 for missing identifier', async () => {
    const { login } = await loadAuthModules()

    let caught: ServiceError | undefined
    try {
      login({ password: 'Admin1234!@#' })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.name).toBe('ServiceError')
    expect(caught?.statusCode).toBe(400)
  })

  it('throws ServiceError with status 400 for missing password', async () => {
    const { login } = await loadAuthModules()

    let caught: ServiceError | undefined
    try {
      login({ identifier: 'admin@alea.club' })
    } catch (err) {
      caught = err as ServiceError
    }

    expect(caught).toBeDefined()
    expect(caught?.name).toBe('ServiceError')
    expect(caught?.statusCode).toBe(400)
  })
})
