import { beforeEach, describe, expect, it, vi } from 'vitest'

async function loadUsersModules() {
  vi.resetModules()

  const service = await import('@/lib/server/users-service')

  return { ...service }
}

describe('listPaginatedUsers', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('clamps page=0 to 1', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = listPaginatedUsers({ page: 0, limit: 10 })

    expect(result.page).toBe(1)
  })

  it('clamps page=-5 to 1', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = listPaginatedUsers({ page: -5, limit: 10 })

    expect(result.page).toBe(1)
  })

  it('clamps limit=0 to default and totalPages is not Infinity', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = listPaginatedUsers({ page: 1, limit: 0 })

    // limit=0 is treated as missing and falls back to the internal default (20)
    // The key invariant: totalPages must never be Infinity
    expect(result.limit).toBeGreaterThanOrEqual(1)
    expect(Number.isFinite(result.totalPages)).toBe(true)
  })

  it('clamps limit=-10 to 1', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = listPaginatedUsers({ page: 1, limit: -10 })

    expect(result.limit).toBe(1)
  })

  it('clamps limit=200 to 100', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = listPaginatedUsers({ page: 1, limit: 200 })

    expect(result.limit).toBe(100)
  })

  it('returns limit=50 as-is when within bounds', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = listPaginatedUsers({ page: 1, limit: 50 })

    expect(result.limit).toBe(50)
  })

  it('filters by email substring case-insensitively', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const result = listPaginatedUsers({ page: 1, limit: 10, search: 'ADMIN' })

    expect(result.data.length).toBeGreaterThan(0)
    result.data.forEach((u) => expect(u.email.toLowerCase()).toContain('admin'))
  })

  it('filters by memberNumber substring', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    // seed member has memberNumber '100002'
    const result = listPaginatedUsers({ page: 1, limit: 10, search: '100002' })

    expect(result.data.length).toBeGreaterThan(0)
    result.data.forEach((u) => expect(u.memberNumber).toContain('100002'))
  })

  it('returns all users when search is empty', async () => {
    const { listPaginatedUsers } = await loadUsersModules()

    const all = listPaginatedUsers({ page: 1, limit: 100 })
    const withEmpty = listPaginatedUsers({ page: 1, limit: 100, search: '' })

    expect(withEmpty.total).toBe(all.total)
  })
})
