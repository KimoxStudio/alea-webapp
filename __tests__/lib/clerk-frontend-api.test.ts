import { describe, expect, it } from 'vitest'
import { getClerkFrontendApiHost } from '@/lib/clerk-frontend-api'

describe('getClerkFrontendApiHost', () => {
  it('derives the host from a valid pk_test_* key', () => {
    const key = 'pk_test_ZXhhY3QtbWFybW9zZXQtMTIuY2xlcmsuYWNjb3VudHMuZGV2JA=='

    expect(getClerkFrontendApiHost(key)).toBe('exact-marmoset-12.clerk.accounts.dev')
  })

  it('derives the host from a valid pk_live_* key', () => {
    const key = 'pk_live_Y2xlcmsuYWxlYWNsdWIuY29tJA=='

    expect(getClerkFrontendApiHost(key)).toBe('clerk.aleaclub.com')
  })

  it('returns null when the key is missing', () => {
    expect(getClerkFrontendApiHost(undefined)).toBeNull()
  })

  it('returns null for a malformed prefix', () => {
    const key = 'pk_staging_ZXhhY3QtbWFybW9zZXQtMTIuY2xlcmsuYWNjb3VudHMuZGV2JA=='

    expect(getClerkFrontendApiHost(key)).toBeNull()
  })

  it('returns null when the third segment is not valid base64', () => {
    const key = 'pk_test_!!!not-base64!!!'

    expect(getClerkFrontendApiHost(key)).toBeNull()
  })

  it('returns null when the decoded value is missing the trailing $', () => {
    // Base64 of "clerk.aleaclub.com" — no trailing '$'.
    const key = 'pk_test_Y2xlcmsuYWxlYWNsdWIuY29t'

    expect(getClerkFrontendApiHost(key)).toBeNull()
  })

  it('returns null when the decoded value has an interior $ before the trailing one', () => {
    // Base64 of "clerk.aleaclub.com$extra$".
    const key = 'pk_live_Y2xlcmsuYWxlYWNsdWIuY29tJGV4dHJhJA=='

    expect(getClerkFrontendApiHost(key)).toBeNull()
  })

  it('returns null when the decoded host has no dot', () => {
    // Base64 of "localhost$".
    const key = 'pk_test_bG9jYWxob3N0JA=='

    expect(getClerkFrontendApiHost(key)).toBeNull()
  })
})
