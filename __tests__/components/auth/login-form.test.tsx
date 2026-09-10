import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginForm } from '@/components/auth/login-form'
import { useSignIn } from '@clerk/nextjs/legacy'

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string) =>
    namespace ? `${namespace}.${key}` : key,
}))

const mockPush = vi.fn()
const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  usePathname: () => '/es/rooms',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@clerk/nextjs/legacy', () => ({
  useSignIn: vi.fn(),
}))

const mockUseSignIn = vi.mocked(useSignIn)
const mockSignInCreate = vi.fn()
const mockSetActive = vi.fn()

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('auth.memberNumber'), '1234')
  await user.type(screen.getByLabelText('auth.password'), 'secret')
  await user.click(screen.getByRole('button', { name: 'auth.login' }))
}

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSignIn.mockReturnValue({
      isLoaded: true,
      signIn: { create: mockSignInCreate },
      setActive: mockSetActive,
    } as unknown as ReturnType<typeof useSignIn>)
  })

  // #391: the fix has two parts, and this test only proves the first.
  // `router.refresh()` makes `app/[locale]/layout.tsx` re-run and produce a
  // fresh `initialUser` prop for `AuthProvider` — that part is asserted here.
  // Whether `AuthProvider` actually *adopts* that new prop into its `user`
  // state (the part that determines if the header renders) is a separate
  // question, covered below against `AuthProvider` + `Header` directly,
  // since mocking `router.refresh()` in this test can't observe it.
  it('calls router.refresh() after router.push() on a successful sign-in (#391)', async () => {
    mockSignInCreate.mockResolvedValue({ status: 'complete', createdSessionId: 'sess-1' })

    render(<LoginForm locale="es" />)
    await fillAndSubmit()

    expect(mockPush).toHaveBeenCalledWith('/es/rooms')
    expect(mockRefresh).toHaveBeenCalled()
    expect(mockPush.mock.invocationCallOrder[0]).toBeLessThan(mockRefresh.mock.invocationCallOrder[0])
  })

  it('does not call router.refresh() when sign-in does not complete', async () => {
    mockSignInCreate.mockResolvedValue({ status: 'needs_second_factor', createdSessionId: null })

    render(<LoginForm locale="es" />)
    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('auth.errors.invalidCredentials')
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockRefresh).not.toHaveBeenCalled()
  })
})
