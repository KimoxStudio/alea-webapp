import type { User } from '@alea/types'
import type { SessionUser } from '@/lib/server/auth'
import { createUser, findUserByEmail, findUserById, findUserByIdentifier, getPublicUser, verifyUserPassword } from '@/lib/server/mock-db'
import { serviceError } from '@/lib/server/service-error'

export function login(input: { identifier?: unknown; password?: unknown }): User {
  const identifier = String(input.identifier ?? '').trim()
  const password = String(input.password ?? '')

  if (!identifier || !password) {
    serviceError('Identifier and password are required', 400)
  }

  const user = findUserByIdentifier(identifier)
  if (!user || !verifyUserPassword(user, password)) {
    serviceError('Invalid credentials', 401)
  }

  return getPublicUser(user)
}

export function register(input: { memberNumber?: unknown; email?: unknown; password?: unknown }): User {
  const memberNumber = String(input.memberNumber ?? '').trim()
  const email = String(input.email ?? '').trim().toLowerCase()
  const password = String(input.password ?? '')

  if (!memberNumber || !email || !password) {
    serviceError('Member number, email and password are required', 400)
  }
  if (password.length < 12) {
    serviceError('Password must be at least 12 characters', 400)
  }
  if (findUserByEmail(email)) {
    serviceError('Email already registered', 409)
  }

  return createUser({ memberNumber, email, password, role: 'member' })
}

export function getCurrentUser(session: SessionUser | null): User {
  if (!session) {
    serviceError('Unauthorized', 401)
  }

  const user = findUserById(session.id)
  if (!user) {
    serviceError('Unauthorized', 401)
  }

  return getPublicUser(user)
}

export function logout() {
  return { success: true }
}
