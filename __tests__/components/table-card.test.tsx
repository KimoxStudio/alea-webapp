import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TableCard } from '@/components/rooms/table-card'
import type { GameTable, TableAvailability, User } from '@/lib/types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

// Mock useAuth
const mockUseAuth = vi.fn()
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

const mockTable: GameTable = {
  id: 't1',
  roomId: '1',
  name: 'Mesa 1',
  type: 'large',
  qrCode: 'QR_T1',
  position: { x: 0, y: 0 },
}

const availableAvailability: TableAvailability = {
  tableId: 't1',
  date: '2025-01-01',
  slots: [
    { startTime: '09:00', endTime: '10:00', available: true },
    { startTime: '10:00', endTime: '11:00', available: true },
  ],
}

const reservedAvailability: TableAvailability = {
  tableId: 't1',
  date: '2025-01-01',
  slots: [
    { startTime: '09:00', endTime: '10:00', available: false },
    { startTime: '10:00', endTime: '11:00', available: false },
  ],
}

describe('TableCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders table name', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
  })

  it('calls onReserve when clicked and available', async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    const user = userEvent.setup()
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    await user.click(screen.getByRole('button'))
    expect(onReserve).toHaveBeenCalledWith(mockTable)
  })

  it('is disabled when fully reserved', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={reservedAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('has correct aria-label', () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      register: vi.fn(),
    })
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('Mesa 1'))
  })

  describe('QR icon visibility', () => {
    it('renders QR icon when user is admin', () => {
      const adminUser: User = {
        id: 'user-123',
        memberNumber: 'M001',
        email: 'admin@example.com',
        role: 'admin',
        isActive: true,
        noShowCount: 0,
        blockedUntil: null,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      }
      mockUseAuth.mockReturnValue({
        user: adminUser,
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
      })
      const onReserve = vi.fn()
      render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
      const qrIcon = screen.getByTestId('qr-icon')
      expect(qrIcon).toBeInTheDocument()
    })

    it('does not render QR icon when user is regular member', () => {
      const memberUser: User = {
        id: 'user-456',
        memberNumber: 'M002',
        email: 'member@example.com',
        role: 'member',
        isActive: true,
        noShowCount: 0,
        blockedUntil: null,
        createdAt: '2025-01-01',
        updatedAt: '2025-01-01',
      }
      mockUseAuth.mockReturnValue({
        user: memberUser,
        isLoading: false,
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
      })
      const onReserve = vi.fn()
      render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
      const qrIcon = screen.queryByTestId('qr-icon')
      expect(qrIcon).not.toBeInTheDocument()
    })

    it('does not render QR icon when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        login: vi.fn(),
        logout: vi.fn(),
        register: vi.fn(),
      })
      const onReserve = vi.fn()
      render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
      const qrIcon = screen.queryByTestId('qr-icon')
      expect(qrIcon).not.toBeInTheDocument()
    })
  })
})
