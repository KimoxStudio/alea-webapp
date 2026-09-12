import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportMembersSection } from '@/components/admin/import-members-section'

// #399 — same fixed-slot fix as users-section.test.tsx: a fixed-size wrapper
// span always occupies the icon's space so the "Actualizar" button never
// grows/shifts, but the DiceLoader itself (and its infinite CSS animation)
// only mounts while the import is actually pending.

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const { importMutationState } = vi.hoisted(() => ({
  importMutationState: { isPending: false, isError: false, mutate: vi.fn() },
}))

vi.mock('@/lib/hooks/use-admin', () => ({
  useAdminImportUsers: () => importMutationState,
}))

function getIconSlot(button: HTMLElement) {
  return button.querySelector('span.shrink-0')
}

function queryLoader(button: HTMLElement) {
  return within(button).queryByTestId('dice-loader')
}

describe('ImportMembersSection — pending import button reserves loader space without animating while idle (#399)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    importMutationState.isPending = false
  })

  it('icon slot is reserved but the loader is unmounted when idle', () => {
    render(<ImportMembersSection />)
    const button = screen.getByRole('button', { name: 'importMembersAction' })
    expect(getIconSlot(button)).toHaveClass('h-4', 'w-4', 'shrink-0')
    expect(queryLoader(button)).toBeNull()
  })

  it('loader mounts, and the button stays disabled by isPending alone, while the import is pending', async () => {
    const user = userEvent.setup()
    const { container, rerender } = render(<ImportMembersSection />)

    // Select a file first so a subsequent disabled assertion is attributable
    // to `importMutation.isPending`, not to the button's separate
    // `!importFile` guard (both disable the button independently).
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['member,data'], 'members.csv', { type: 'text/csv' })
    await user.upload(fileInput, file)

    importMutationState.isPending = true
    rerender(<ImportMembersSection />)

    const button = screen.getByRole('button', { name: 'importMembersAction' })
    expect(getIconSlot(button)).not.toBeNull()
    expect(queryLoader(button)).not.toBeNull()
    expect(button).toBeDisabled()
  })
})
