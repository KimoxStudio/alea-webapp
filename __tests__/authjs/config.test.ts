// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/authjs/credentials-user', () => ({
  verifyCredentials: vi.fn(),
}))

import { authConfig } from '@/lib/authjs/config'

describe('authConfig', () => {
  describe('session strategy', () => {
    it('uses JWT session strategy', () => {
      expect(authConfig.session).toBeDefined()
      expect(authConfig.session?.strategy).toBe('jwt')
    })
  })

  describe('providers', () => {
    it('exports exactly one provider', () => {
      expect(authConfig.providers).toBeDefined()
      expect(authConfig.providers).toHaveLength(1)
    })

    it('configures a Credentials provider', () => {
      const provider = authConfig.providers[0]
      expect(provider).toBeDefined()
      expect(provider.id).toBe('credentials')
    })

    it('Credentials provider has email and password fields', () => {
      const provider = authConfig.providers[0] as any
      expect(provider.credentials).toBeDefined()
      expect(provider.credentials.email).toBeDefined()
      expect(provider.credentials.password).toBeDefined()
    })

    it('Credentials provider has email and password labels', () => {
      const provider = authConfig.providers[0] as any
      expect(provider.credentials.email.label).toBe('Email')
      expect(provider.credentials.password.label).toBe('Password')
    })

    it('Credentials provider has email and password types', () => {
      const provider = authConfig.providers[0] as any
      expect(provider.credentials.email.type).toBe('email')
      expect(provider.credentials.password.type).toBe('password')
    })
  })
})
