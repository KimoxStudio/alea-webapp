import type { PaginatedResponse, User } from '@alea/types'
import { deleteUserById, findUserById, getPublicUser, listUsers, updateUserById } from '@/lib/server/mock-db'
import { serviceError } from '@/lib/server/service-error'

export function listPaginatedUsers(input: {
  page: number
  limit: number
  search?: string
}): PaginatedResponse<User> {
  const page = Math.max(1, Math.floor(Number(input.page)) || 1)
  const limit = Math.min(100, Math.max(1, Math.floor(Number(input.limit)) || 20))
  const search = input.search?.trim().toLowerCase() ?? ''

  let filtered = listUsers()
  if (search) {
    filtered = filtered.filter((u) => u.email.toLowerCase().includes(search) || u.memberNumber.includes(search))
  }

  const total = filtered.length
  return {
    data: filtered.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export function updateUser(id: string, body: { memberNumber?: unknown; email?: unknown; role?: unknown }) {
  const existing = findUserById(id)
  if (!existing) {
    serviceError('User not found', 404)
  }

  const updated = updateUserById(id, {
    memberNumber: body.memberNumber ? String(body.memberNumber) : undefined,
    email: body.email ? String(body.email).toLowerCase() : undefined,
    role: body.role === 'admin' || body.role === 'member' ? body.role : undefined,
  })

  return updated ?? getPublicUser(existing)
}

export function deleteUser(id: string) {
  if (!deleteUserById(id)) {
    serviceError('User not found', 404)
  }
}
