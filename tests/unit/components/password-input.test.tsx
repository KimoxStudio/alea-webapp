import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PasswordInput } from '@/components/ui/password-input'

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('PasswordInput', () => {
  it('renders a password input by default', () => {
    render(<PasswordInput aria-label="password field" />)
    const input = screen.getByLabelText('password field')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('toggles visibility when the button is clicked', async () => {
    const user = userEvent.setup()
    render(<PasswordInput aria-label="password field" />)
    const input = screen.getByLabelText('password field')
    const toggle = screen.getByRole('button', { name: 'showPassword' })

    await user.click(toggle)
    expect(input).toHaveAttribute('type', 'text')

    await user.click(toggle)
    expect(input).toHaveAttribute('type', 'password')
  })

  it('uses password aria-labels by default', () => {
    render(<PasswordInput />)
    expect(screen.getByRole('button', { name: 'showPassword' })).toBeInTheDocument()
  })

  it('uses confirmation aria-labels when variant is confirmation', () => {
    render(<PasswordInput variant="confirmation" />)
    expect(screen.getByRole('button', { name: 'showConfirmation' })).toBeInTheDocument()
  })

  it('shows hideConfirmation label when toggled with confirmation variant', async () => {
    const user = userEvent.setup()
    render(<PasswordInput variant="confirmation" />)
    const toggle = screen.getByRole('button', { name: 'showConfirmation' })

    await user.click(toggle)
    expect(screen.getByRole('button', { name: 'hideConfirmation' })).toBeInTheDocument()
  })

  it('ignores caller-provided type prop', () => {
    render(<PasswordInput type="text" aria-label="password field" />)
    const input = screen.getByLabelText('password field')
    expect(input).toHaveAttribute('type', 'password')
  })

  it('forwards ref correctly', () => {
    const ref = vi.fn()
    render(<PasswordInput ref={ref} />)
    expect(ref).toHaveBeenCalled()
  })

  it('passes additional props to the underlying input', () => {
    render(<PasswordInput placeholder="Enter password" aria-label="password field" />)
    const input = screen.getByLabelText('password field')
    expect(input).toHaveAttribute('placeholder', 'Enter password')
  })
})
