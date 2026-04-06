import { useState, useCallback } from 'react'
import type { User } from '@/lib/types'

interface UseAdminUsersOptions {
  initialUsers?: User[]
}

interface UseAdminUsersReturn {
  users: User[]
  loading: boolean
  error: string | null
  updateUser: (id: string, payload: { role?: 'member' | 'admin'; is_active?: boolean }) => Promise<void>
  deleteUser: (id: string) => Promise<void>
  setUsers: (users: User[]) => void
}

export function useAdminUsers({ initialUsers = [] }: UseAdminUsersOptions = {}): UseAdminUsersReturn {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateUser = useCallback(async (
    id: string,
    payload: { role?: 'member' | 'admin'; is_active?: boolean },
  ) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { message?: string }).message ?? 'Failed to update user')
      }
      const updated: User = await res.json()
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const deleteUser = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { message?: string }).message ?? 'Failed to delete user')
      }
      setUsers((prev) => prev.filter((u) => u.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { users, loading, error, updateUser, deleteUser, setUsers }
}
