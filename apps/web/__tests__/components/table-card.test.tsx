import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TableCard } from '@/components/rooms/table-card'
import type { GameTable, TableAvailability } from '@alea/types'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
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
  it('renders table name', () => {
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    expect(screen.getByText('Mesa 1')).toBeInTheDocument()
  })

  it('calls onReserve when clicked and available', async () => {
    const user = userEvent.setup()
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    await user.click(screen.getByRole('button'))
    expect(onReserve).toHaveBeenCalledWith(mockTable)
  })

  it('is disabled when fully reserved', () => {
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={reservedAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('has correct aria-label', () => {
    const onReserve = vi.fn()
    render(<TableCard table={mockTable} availability={availableAvailability} onReserve={onReserve} currentDate="2025-01-01" />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', expect.stringContaining('Mesa 1'))
  })
})
