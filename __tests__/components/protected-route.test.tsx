import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProtectedRoute } from '@/components/auth/protected-route'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/lib/auth/auth-context'

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('shows loading spinner when auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    render(
      <ProtectedRoute locale="es">
        <div>Protected content</div>
      </ProtectedRoute>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: '1', memberNumber: '100001', role: 'member', createdAt: '', updatedAt: '' },
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    render(
      <ProtectedRoute locale="es">
        <div>Protected content</div>
      </ProtectedRoute>
    )
    expect(screen.getByText('Protected content')).toBeInTheDocument()
  })

  it('redirects to login when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    render(
      <ProtectedRoute locale="es">
        <div>Protected content</div>
      </ProtectedRoute>
    )
    expect(mockPush).toHaveBeenCalledWith('/es/login')
  })

  it('does not render children when not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    render(
      <ProtectedRoute locale="en">
        <div>Protected content</div>
      </ProtectedRoute>
    )
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument()
    expect(mockPush).toHaveBeenCalledWith('/en/login')
  })
})
