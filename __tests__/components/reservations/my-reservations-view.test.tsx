import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyReservationsView } from '@/components/reservations/my-reservations-view'
import type { Reservation } from '@/lib/types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'reservations.title': 'My Reservations',
      'reservations.subtitle': 'Manage your reservations',
      'reservations.active': 'Active',
      'reservations.completed': 'Completed',
      'reservations.cancelled': 'Cancelled',
      'reservations.noReservations': 'No reservations',
      'reservations.cancel': 'Cancel Reservation',
      'reservations.cancelConfirm': 'Are you sure you want to cancel?',
      'reservations.confirming': 'Confirming...',
      'reservations.confirmCancel': 'Confirm Cancel',
      'reservations.canceling': 'Canceling...',
      'reservations.errors.cancellationCutoff': 'Cancellation is no longer available — the cutoff period has passed.',
      'errors.cancellationCutoff': 'Cancellation is no longer available — the cutoff period has passed.',
    }
    return translations[key] || key
  },
}))

// Mock auth context
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
  }),
}))

// Mock reservations hook
const mockUseMyReservations = vi.fn()
const mockUseCancelReservation = vi.fn()

vi.mock('@/lib/hooks/use-reservations', () => ({
  useMyReservations: () => mockUseMyReservations(),
  useCancelReservation: () => mockUseCancelReservation(),
}))

// Mock utility functions
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>()
  return {
    ...actual,
    formatDate: (date: string) => date,
    formatTime: (time: string) => time,
  }
})

const mockReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: 'res-1',
  tableId: 'table-1',
  userId: 'user-123',
  date: '2025-12-31',
  startTime: '14:00',
  endTime: '16:00',
  status: 'active' as const,
  surface: null,
  createdAt: '2025-12-01T00:00:00Z',
  memberNumber: '123',
  roomName: 'Tavern',
  tableName: 'Table 1',
  ...overrides,
})

describe('MyReservationsView — cutoff behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseCancelReservation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('isCutoffPassed() — reservation >60 min in future', () => {
    it('should enable cancel button when reservation is >60 min away', () => {
      // Set current time to 2025-12-31 12:00:00
      const now = new Date('2025-12-31T12:00:00Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      // Reservation starts at 14:00, which is 120 minutes away
      const reservation = mockReservation({
        date: '2025-12-31',
        startTime: '14:00',
      })

      mockUseMyReservations.mockReturnValue({
        data: [reservation],
        isLoading: false,
      })

      render(<MyReservationsView />)

      // Cancel button should be enabled (key is 'cancel')
      const cancelButton = screen.getByRole('button', { name: 'cancel' })
      expect(cancelButton).not.toBeDisabled()
      expect(cancelButton).toHaveAttribute('aria-disabled', 'false')

      // Cutoff note should NOT be visible
      const cutoffNote = screen.queryByRole('note')
      expect(cutoffNote).not.toBeInTheDocument()

      vi.useRealTimers()
    })
  })

  describe('isCutoffPassed() — reservation <60 min in future', () => {
    it('should disable cancel button when reservation is <60 min away', () => {
      // Set current time to 2025-12-31 13:31:00 (29 minutes before 14:00)
      const now = new Date('2025-12-31T13:31:00Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      const reservation = mockReservation({
        date: '2025-12-31',
        startTime: '14:00',
      })

      mockUseMyReservations.mockReturnValue({
        data: [reservation],
        isLoading: false,
      })

      render(<MyReservationsView />)

      // Cancel button should be disabled
      const cancelButton = screen.getByRole('button', { name: 'cancel' })
      expect(cancelButton).toBeDisabled()
      expect(cancelButton).toHaveAttribute('aria-disabled', 'true')

      // Cutoff note should be visible
      const cutoffNote = screen.getByRole('note')
      expect(cutoffNote).toBeInTheDocument()
      expect(cutoffNote).toHaveTextContent('Cancellation is no longer available — the cutoff period has passed.')

      vi.useRealTimers()
    })
  })

  describe('isCutoffPassed() — reservation in past', () => {
    it('should disable cancel button when reservation is in the past', () => {
      // Set current time to 2026-01-01 (after 2025-12-31 14:00)
      const now = new Date('2026-01-01T00:00:00Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      const reservation = mockReservation({
        date: '2025-12-31',
        startTime: '14:00',
      })

      mockUseMyReservations.mockReturnValue({
        data: [reservation],
        isLoading: false,
      })

      render(<MyReservationsView />)

      // Cancel button should be disabled
      const cancelButton = screen.getByRole('button', { name: 'cancel' })
      expect(cancelButton).toBeDisabled()
      expect(cancelButton).toHaveAttribute('aria-disabled', 'true')

      // Cutoff note should be visible
      const cutoffNote = screen.getByRole('note')
      expect(cutoffNote).toBeInTheDocument()
      expect(cutoffNote).toHaveTextContent('Cancellation is no longer available — the cutoff period has passed.')

      vi.useRealTimers()
    })
  })

  describe('ReservationCard — non-active reservations', () => {
    it('should not render cancel button for completed reservations', () => {
      const reservation = mockReservation({
        status: 'completed' as const,
        date: '2025-12-31',
        startTime: '14:00',
      })

      mockUseMyReservations.mockReturnValue({
        data: [reservation],
        isLoading: false,
      })

      render(<MyReservationsView />)

      // Cancel button should not be rendered for non-active reservations
      const cancelButtons = screen.queryAllByRole('button', { name: 'cancel' })
      expect(cancelButtons).toHaveLength(0)
    })

    it('should not render cancel button for cancelled reservations', () => {
      const reservation = mockReservation({
        status: 'cancelled' as const,
        date: '2025-12-31',
        startTime: '14:00',
      })

      mockUseMyReservations.mockReturnValue({
        data: [reservation],
        isLoading: false,
      })

      render(<MyReservationsView />)

      // Cancel button should not be rendered for cancelled reservations
      const cancelButtons = screen.queryAllByRole('button', { name: 'cancel' })
      expect(cancelButtons).toHaveLength(0)
    })
  })

  describe('ReservationCard — multiple reservations with mixed cutoff states', () => {
    it('should correctly disable cutoff-passed reservations and enable others', () => {
      const now = new Date('2025-12-31T12:00:00Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      // Reservation 1: 120 minutes away (should be enabled)
      const res1 = mockReservation({
        id: 'res-1',
        date: '2025-12-31',
        startTime: '14:00', // 120 min away
      })

      // Reservation 2: 30 minutes away (should be disabled)
      const res2 = mockReservation({
        id: 'res-2',
        date: '2025-12-31',
        startTime: '12:30', // 30 min away
      })

      mockUseMyReservations.mockReturnValue({
        data: [res1, res2],
        isLoading: false,
      })

      render(<MyReservationsView />)

      const cancelButtons = screen.getAllByRole('button', { name: 'cancel' })
      expect(cancelButtons).toHaveLength(2)

      // First reservation (120 min away) should be enabled
      expect(cancelButtons[0]).not.toBeDisabled()

      // Second reservation (30 min away) should be disabled
      expect(cancelButtons[1]).toBeDisabled()

      vi.useRealTimers()
    })
  })

  describe('ReservationCard — cutoff note styling and visibility', () => {
    it('should display cutoff note with proper accessibility attributes', () => {
      const now = new Date('2025-12-31T13:31:00Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(now)

      const reservation = mockReservation({
        date: '2025-12-31',
        startTime: '14:00',
      })

      mockUseMyReservations.mockReturnValue({
        data: [reservation],
        isLoading: false,
      })

      render(<MyReservationsView />)

      const cutoffNote = screen.getByRole('note')
      expect(cutoffNote).toHaveClass('text-xs', 'text-muted-foreground')
      expect(cutoffNote).toHaveTextContent('Cancellation is no longer available — the cutoff period has passed.')

      vi.useRealTimers()
    })
  })

  describe('ReservationCard — empty state', () => {
    it('should display empty state when no reservations exist', () => {
      mockUseMyReservations.mockReturnValue({
        data: [],
        isLoading: false,
      })

      render(<MyReservationsView />)

      // The translation key is passed through directly in the mock
      expect(screen.getByText('noReservations')).toBeInTheDocument()
    })
  })
})
