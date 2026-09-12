// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

// Synthetic pk_test_* key so `next.config.ts` can derive a Clerk Frontend
// API host without depending on the real value in .env.local. Decodes (per
// getClerkFrontendApiHost in lib/clerk-frontend-api.ts) to
// "test.clerk.accounts.dev$".
const TEST_CLERK_PUBLISHABLE_KEY = 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'

async function getContentSecurityPolicy(): Promise<string> {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', TEST_CLERK_PUBLISHABLE_KEY)

  const { default: config } = await import('@/next.config')
  const headerGroups = await config.headers?.()
  const headers = headerGroups?.[0]?.headers ?? []
  const csp = headers.find((header) => header.key === 'Content-Security-Policy')

  if (!csp) {
    throw new Error('Content-Security-Policy header not found in next.config.ts headers()')
  }

  return csp.value
}

describe('Content-Security-Policy (next.config.ts)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('allows the Google Fonts stylesheet in style-src', async () => {
    const csp = await getContentSecurityPolicy()
    const styleSrc = csp.split('; ').find((directive) => directive.startsWith('style-src '))

    expect(styleSrc).toContain('https://fonts.googleapis.com')
  })

  it('allows Google Fonts font files in font-src', async () => {
    const csp = await getContentSecurityPolicy()
    const fontSrc = csp.split('; ').find((directive) => directive.startsWith('font-src '))

    expect(fontSrc).toContain('https://fonts.gstatic.com')
  })

  it('does not use a wildcard host for the Google Fonts allowances', async () => {
    const csp = await getContentSecurityPolicy()

    expect(csp).not.toContain('*.googleapis.com')
    expect(csp).not.toContain('*.gstatic.com')
  })
})
