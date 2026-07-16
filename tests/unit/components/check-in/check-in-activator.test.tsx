import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CheckInActivator } from '@/components/check-in/check-in-activator'
import { apiClient } from '@/lib/api/client'

vi.mock('@/lib/api/client', () => ({
  apiClient: { post: vi.fn() },
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const mockPost = vi.mocked(apiClient.post)

describe('CheckInActivator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    mockPost.mockImplementationOnce(() => new Promise(() => {})) // Never resolves

    render(<CheckInActivator tableId="t1" />)

    const loadingText = screen.getByText('loading')
    expect(loadingText).toBeDefined()
    // The loading text is rendered with animate-pulse class on the <p> element
    expect(loadingText.className).toContain('animate-pulse')
  })

  it('renders activated result when post succeeds', async () => {
    mockPost.mockResolvedValueOnce({ reservation: { id: 'r1' } })

    render(<CheckInActivator tableId="t1" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    expect(mockPost).toHaveBeenCalledWith('/tables/t1/activate')
    // Assert the activated status message is rendered
    await screen.findByText('activated')
  })

  it('renders already_active result when post throws already_active error', async () => {
    mockPost.mockRejectedValueOnce({
      message: 'CHECK_IN_ALREADY_ACTIVE',
      statusCode: 409,
    })

    render(<CheckInActivator tableId="t1" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    expect(mockPost).toHaveBeenCalledWith('/tables/t1/activate')
    // Assert the alreadyActive status message is rendered
    await screen.findByText('alreadyActive')
  })

  it('renders too_early result when post throws too_early error', async () => {
    mockPost.mockRejectedValueOnce({
      message: 'CHECK_IN_TOO_EARLY',
      statusCode: 400,
    })

    render(<CheckInActivator tableId="t1" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    expect(mockPost).toHaveBeenCalledWith('/tables/t1/activate')
    // Assert the tooEarly status message is rendered
    await screen.findByText('tooEarly')
  })

  it('renders too_late result when post throws too_late error', async () => {
    mockPost.mockRejectedValueOnce({
      message: 'CHECK_IN_TOO_LATE',
      statusCode: 400,
    })

    render(<CheckInActivator tableId="t1" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    expect(mockPost).toHaveBeenCalledWith('/tables/t1/activate')
    // Assert the tooLate status message is rendered
    await screen.findByText('tooLate')
  })

  it('renders error result when post rejects (network error)', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network error'))

    render(<CheckInActivator tableId="t1" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    expect(mockPost).toHaveBeenCalledWith('/tables/t1/activate')
    // Assert the error status message is rendered
    await screen.findByText('error')
  })

  it('renders error result when post throws unknown error', async () => {
    mockPost.mockRejectedValueOnce({
      message: 'UNKNOWN_ERROR',
      statusCode: 500,
    })

    render(<CheckInActivator tableId="t1" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    // Assert the error status message is rendered
    await screen.findByText('error')
  })

  it('renders no_reservation result when post throws no_reservation error', async () => {
    mockPost.mockRejectedValueOnce({
      message: 'CHECK_IN_NO_RESERVATION',
      statusCode: 404,
    })

    render(<CheckInActivator tableId="t1" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    // Assert the noReservation status message is rendered
    await screen.findByText('noReservation')
  })

  it('passes side=inf query parameter when side prop is inf', async () => {
    mockPost.mockResolvedValueOnce({ reservation: { id: 'r1' } })

    render(<CheckInActivator tableId="t1" side="inf" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    expect(mockPost).toHaveBeenCalledWith('/tables/t1/activate?side=inf')
  })

  it('does not pass side query parameter when side prop is not inf', async () => {
    mockPost.mockResolvedValueOnce({ reservation: { id: 'r1' } })

    render(<CheckInActivator tableId="t1" side="sup" />)

    await waitFor(() => {
      expect(screen.queryByText('loading')).toBeNull()
    })

    expect(mockPost).toHaveBeenCalledWith('/tables/t1/activate')
  })
})
