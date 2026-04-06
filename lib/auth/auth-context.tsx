'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@/lib/types'
import { apiClient } from '@/lib/api/client'
import { endpoints } from '@/lib/api/endpoints'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (memberNumber: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children, initialUser }: { children: React.ReactNode; initialUser?: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser ?? null)
  const [isLoading, setIsLoading] = useState(initialUser === undefined)
  const router = useRouter()

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiClient.get<User>(endpoints.auth.me)
      setUser(data)
    } catch { setUser(null) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => {
    if (initialUser !== undefined) return
    checkAuth()
  }, [checkAuth, initialUser])

  const login = async (identifier: string, password: string) => {
    const data = await apiClient.post<User>(endpoints.auth.login, { identifier, password })
    setUser(data)
  }
  const logout = async () => {
    await apiClient.post(endpoints.auth.logout)
    setUser(null)
    router.push('/')
  }
  const register = async (memberNumber: string, password: string) => {
    const data = await apiClient.post<User>(endpoints.auth.register, { memberNumber, password })
    setUser(data)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
