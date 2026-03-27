'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User } from '@alea/types'
import { apiClient } from '@/lib/api/client'
import { endpoints } from '@/lib/api/endpoints'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (memberNumber: string, email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const checkAuth = useCallback(async () => {
    try {
      const data = await apiClient.get<User>(endpoints.auth.me)
      setUser(data)
    } catch { setUser(null) }
    finally { setIsLoading(false) }
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const login = async (identifier: string, password: string) => {
    const data = await apiClient.post<User>(endpoints.auth.login, { identifier, password })
    setUser(data)
  }
  const logout = async () => {
    await apiClient.post(endpoints.auth.logout)
    setUser(null)
  }
  const register = async (memberNumber: string, email: string, password: string) => {
    const data = await apiClient.post<User>(endpoints.auth.register, { memberNumber, email, password })
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
