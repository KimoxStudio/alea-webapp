import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  logout: vi.fn(),
  user: {
    id: 'user-1',
    memberNumber: '123456',
    role: 'member' as const,
  },
}))

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/es/rooms',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    user: authMock.user,
    logout: authMock.logout,
    isAuthenticated: true,
  }),
}))

import { Footer } from '@/components/layout/footer'
import { Header } from '@/components/layout/header'

describe('FAQ navigation links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('links to the localized FAQ from the authenticated desktop navigation', () => {
    render(<Header locale="es" />)

    const desktopNav = screen.getByRole('navigation', { name: 'nav.mainNavAriaLabel' })
    expect(within(desktopNav).getByRole('link', { name: 'nav.faq' })).toHaveAttribute('href', '/es/faq')
  })

  it('opens the mobile menu, links to FAQ, and closes after selection', async () => {
    const user = userEvent.setup()
    render(<Header locale="en" />)

    expect(screen.queryByRole('navigation', { name: 'nav.mobileNavAriaLabel' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'nav.menuAriaLabel' }))

    const mobileNav = screen.getByRole('navigation', { name: 'nav.mobileNavAriaLabel' })
    const faqLink = within(mobileNav).getByRole('link', { name: 'nav.faq' })
    expect(faqLink).toHaveAttribute('href', '/en/faq')

    faqLink.addEventListener('click', (event) => event.preventDefault())
    await user.click(faqLink)
    expect(screen.queryByRole('navigation', { name: 'nav.mobileNavAriaLabel' })).not.toBeInTheDocument()
  })

  it('links to the localized FAQ from the public footer', () => {
    render(<Footer locale="es" />)

    const footer = screen.getByRole('contentinfo')
    expect(within(footer).getByRole('link', { name: 'footer.faq' })).toHaveAttribute('href', '/es/faq')
  })
})
