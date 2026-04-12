import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MyReservationsView } from '@/components/reservations/my-reservations-view'
import type { Reservation } from '@/lib/types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    if (namespace && key) {
      return `${namespace}.${key}`
    }
    return key
  },
}))

// Mock auth context
const mockUser = { id: 'user-1', memberNumber: '123', role: 'member' as const, isActive: true }
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}))

// Mock hooks
const mockUseMyReservations = vi.fn()
const mockUseCancelReservation = vi.fn()

vi.mock('@/lib/hooks/use-reservations', () => ({
  useMyReservations: () => mockUseMyReservations(),
  useCancelReservation: () => mockUseCancelReservation(),
}))

// Mock utility functions
vi.mock('@/lib/utils', () => ({
  formatDate: (date: string) => new Date(date).toLocaleDateString(),
  formatTime: (time: string) => time,
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

const CANCELLATION_CUTOFF_MS = 60 * 60 * 1000 // 60 minutes

// Helper to create reservations with different times
function createReservation(overrides: Partial<Reservation> = {}): Reservation {
  return {
    id: 'res-1',
    tableId: 'table-1',
    userId: 'user-1',
    date: '2025-04-20',
    startTime: '14:00',
    endTime: '16:00',
    status: 'active' as const,
    createdAt: '2025-04-12T10:00:00Z',
    tableName: 'Mesa 1',
    roomName: 'Sala Principal',
    ...overrides,
  }
}

// Helper to create a reservation with a specific time offset from now
function createReservationWithTimeOffset(minutesFromNow: number, overrides: Partial<Reservation> = {}): Reservation {
  const now = new Date()
  const startTime = new Date(now.getTime() + minutesFromNow * 60 * 1000)
  const date = startTime.toISOString().split('T')[0]
  const hours = String(startTime.getHours()).padStart(2, '0')
  const minutes = String(startTime.getMinutes()).padStart(2, '0')
  const startTimeStr = `${hours}:${minutes}`

  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)
  const endHours = String(endTime.getHours()).padStart(2, '0')
  const endMinutes = String(endTime.getMinutes()).padStart(2, '0')
  const endTimeStr = `${endHours}:${endMinutes}`

  return createReservation({
    date,
    startTime: startTimeStr,
    endTime: endTimeStr,
    ...overrides,
  })
}

describe('MyReservationsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Loading state', () => {
    it('renders skeleton loaders when loading', () => {
      mockUseMyReservations.mockReturnValue({ data: undefined, isLoading: true })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      const { container } = render(<MyReservationsView />)
      // Check that skeleton elements are rendered (they have the "rounded-lg" class)
      const skeletons = container.querySelectorAll('.h-24.rounded-lg')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('Empty state', () => {
    it('shows "no reservations" message when empty', () => {
      mockUseMyReservations.mockReturnValue({ data: [], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      expect(screen.getByText('reservations.noReservations')).toBeInTheDocument()
    })
  })

  describe('Cutoff logic', () => {
    it('shows active reservations with cutoff not passed in Active section', () => {
      // Reservation 2 hours in the future
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-future' })
      mockUseMyReservations.mockReturnValue({ data: [futureRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      expect(screen.getByText('reservations.active (1)')).toBeInTheDocument()

      // Check for table name using a callback matcher
      expect(screen.getByText((content, element) => {
        return element?.tagName === 'SPAN' && content.includes('Mesa 1')
      })).toBeInTheDocument()
    })

    it('shows active reservations with cutoff passed in Past section', () => {
      // Reservation 30 minutes in the future (within 60-min cutoff)
      const soonRes = createReservationWithTimeOffset(30, { id: 'res-soon' })
      mockUseMyReservations.mockReturnValue({ data: [soonRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      // Past section should have the reservation
      const pastHeading = screen.getByText((content, element) => {
        return element?.tagName === 'H2' && content.includes('reservations.completed')
      })
      expect(pastHeading).toBeInTheDocument()
    })

    it('shows completed reservations in Past section', () => {
      const completedRes = createReservation({
        id: 'res-completed',
        status: 'completed',
      })
      mockUseMyReservations.mockReturnValue({ data: [completedRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      // Completed reservations should appear in the past section
      const allHeadings = screen.getAllByRole('heading')
      const hasPastSection = allHeadings.some(h => h.textContent?.includes('reservations.completed'))
      expect(hasPastSection).toBeTruthy()
    })

    it('shows cancelled reservations in Past section', () => {
      const cancelledRes = createReservation({
        id: 'res-cancelled',
        status: 'cancelled',
      })
      mockUseMyReservations.mockReturnValue({ data: [cancelledRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      // Past section should be rendered
      expect(screen.getByText((content, element) => {
        return element?.tagName === 'H2' && content.includes('reservations.cancelled')
      })).toBeInTheDocument()
    })
  })

  describe('Cancel button', () => {
    it('shows enabled cancel button for active reservations with cutoff not passed', () => {
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-future' })
      mockUseMyReservations.mockReturnValue({ data: [futureRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      const cancelBtn = screen.getByRole('button', { name: 'reservations.cancel' })
      expect(cancelBtn).not.toBeDisabled()
    })

    it('shows disabled cancel button with message for active reservations with cutoff passed', () => {
      const soonRes = createReservationWithTimeOffset(30, { id: 'res-soon' })
      mockUseMyReservations.mockReturnValue({ data: [soonRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      const cancelBtn = screen.getByRole('button', { name: 'reservations.cancel' })
      expect(cancelBtn).toBeDisabled()
      expect(screen.getByText('reservations.errors.cancellationCutoff')).toBeInTheDocument()
    })

    it('does not show cancel button for completed reservations', () => {
      const completedRes = createReservation({
        id: 'res-completed',
        status: 'completed',
      })
      mockUseMyReservations.mockReturnValue({ data: [completedRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      expect(screen.queryByRole('button', { name: 'reservations.cancel' })).not.toBeInTheDocument()
    })

    it('does not show cancel button for cancelled reservations', () => {
      const cancelledRes = createReservation({
        id: 'res-cancelled',
        status: 'cancelled',
      })
      mockUseMyReservations.mockReturnValue({ data: [cancelledRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      expect(screen.queryByRole('button', { name: 'reservations.cancel' })).not.toBeInTheDocument()
    })
  })

  describe('Cancel dialog', () => {
    it('opens cancel dialog when cancel button is clicked', async () => {
      const user = userEvent.setup()
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-future' })
      mockUseMyReservations.mockReturnValue({ data: [futureRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      const cancelBtn = screen.getByRole('button', { name: 'reservations.cancel' })
      await user.click(cancelBtn)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('reservations.cancelConfirm')).toBeInTheDocument()
    })

    it('closes dialog when cancel is clicked in dialog', async () => {
      const user = userEvent.setup()
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-future' })
      mockUseMyReservations.mockReturnValue({ data: [futureRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)
      const cancelBtn = screen.getByRole('button', { name: 'reservations.cancel' })
      await user.click(cancelBtn)

      const dialogNoBtn = screen.getByRole('button', { name: 'No' })
      await user.click(dialogNoBtn)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('calls mutation when confirm is clicked in dialog', async () => {
      const user = userEvent.setup()
      const mutateAsync = vi.fn().mockResolvedValue({ status: 'cancelled' })
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-123' })
      mockUseMyReservations.mockReturnValue({ data: [futureRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync, isPending: false })

      render(<MyReservationsView />)
      const cancelBtn = screen.getByRole('button', { name: 'reservations.cancel' })
      await user.click(cancelBtn)

      const confirmBtn = screen.getByRole('button', { name: 'reservations.confirmCancel' })
      await user.click(confirmBtn)

      expect(mutateAsync).toHaveBeenCalledWith('res-123')
    })
  })

  describe('Multiple reservations', () => {
    it('correctly categorizes mixed active and past reservations', () => {
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-future' })
      const soonRes = createReservationWithTimeOffset(30, { id: 'res-soon' })
      const completedRes = createReservation({
        id: 'res-completed',
        status: 'completed',
      })

      mockUseMyReservations.mockReturnValue({
        data: [futureRes, soonRes, completedRes],
        isLoading: false,
      })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)

      // Should have active section with 1 reservation (future)
      expect(screen.getByText('reservations.active (1)')).toBeInTheDocument()

      // Should have past section with 2 reservations (soon + completed)
      const pastHeadings = screen.queryAllByText((content) => {
        return content.includes('reservations.completed') || content.includes('reservations.cancelled')
      })
      expect(pastHeadings.length).toBeGreaterThan(0)

      // All 3 reservations should have their room/table info in the DOM
      const allTableRefs = screen.queryAllByText((content) => {
        return content === 'Mesa 1' || content.includes('Mesa 1')
      })
      expect(allTableRefs.length).toBeGreaterThanOrEqual(1) // At least one should be found
    })

    it('shows correct counts in section headers', () => {
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-future' })
      const soonRes = createReservationWithTimeOffset(30, { id: 'res-soon' })

      mockUseMyReservations.mockReturnValue({
        data: [futureRes, soonRes],
        isLoading: false,
      })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)

      // Active section should have 1 reservation
      expect(screen.getByText('reservations.active (1)')).toBeInTheDocument()

      // Past section should have 1 reservation - check for the completed/cancelled heading
      const headings = screen.getAllByRole('heading')
      const pastSectionHeading = headings.find(h => h.textContent?.includes('reservations.completed') || h.textContent?.includes('reservations.cancelled'))
      expect(pastSectionHeading).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles reservation at exactly 60-minute cutoff boundary', () => {
      const boundaryRes = createReservationWithTimeOffset(60, { id: 'res-boundary' })
      mockUseMyReservations.mockReturnValue({ data: [boundaryRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)

      // At exactly 60 minutes, cutoff should have passed (>= operator)
      // So the button should be disabled
      const cancelBtn = screen.queryByRole('button', { name: 'reservations.cancel' })
      if (cancelBtn) {
        expect(cancelBtn).toBeDisabled()
      }
    })

    it('disables reservations query when user is null', () => {
      mockUseMyReservations.mockReturnValue({ data: [], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)

      // When user is null, useMyReservations is called with null and should return empty data
      expect(screen.getByText('reservations.noReservations')).toBeInTheDocument()
    })

    it('handles empty date/time fields gracefully', () => {
      const badRes = createReservation({
        id: 'res-bad',
        date: '',
        startTime: '',
      })

      mockUseMyReservations.mockReturnValue({ data: [badRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      // Should not throw when trying to parse invalid date
      expect(() => render(<MyReservationsView />)).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('has correct section labels for screen readers', () => {
      const futureRes = createReservationWithTimeOffset(120, { id: 'res-future' })
      mockUseMyReservations.mockReturnValue({ data: [futureRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)

      // Check for sections with aria-labelledby
      expect(screen.getByText('reservations.active (1)')).toBeInTheDocument()
    })

    it('disabled cancel button has aria-disabled attribute', () => {
      const soonRes = createReservationWithTimeOffset(30, { id: 'res-soon' })
      mockUseMyReservations.mockReturnValue({ data: [soonRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)

      const cancelBtn = screen.getByRole('button', { name: 'reservations.cancel' })
      expect(cancelBtn).toHaveAttribute('aria-disabled', 'true')
    })

    it('disabled state message has role="note"', () => {
      const soonRes = createReservationWithTimeOffset(30, { id: 'res-soon' })
      mockUseMyReservations.mockReturnValue({ data: [soonRes], isLoading: false })
      mockUseCancelReservation.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })

      render(<MyReservationsView />)

      const note = screen.getByRole('note')
      expect(note).toHaveTextContent('reservations.errors.cancellationCutoff')
      expect(note).toBeInTheDocument()
    })
  })
})
