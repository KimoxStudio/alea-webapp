// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/authjs/credentials-user')

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

    it('Credentials provider has authorize function', () => {
      const provider = authConfig.providers[0] as any
      expect(provider.authorize).toBeDefined()
      expect(typeof provider.authorize).toBe('function')
    })

    it('authorize returns null when email is missing', async () => {
      const provider = authConfig.providers[0] as any
      const result = await provider.authorize({
        password: 'password123',
      })
      expect(result).toBeNull()
    })

    it('authorize returns null when password is missing', async () => {
      const provider = authConfig.providers[0] as any
      const result = await provider.authorize({
        email: 'test@example.com',
      })
      expect(result).toBeNull()
    })

    it('authorize returns null when both email and password are missing', async () => {
      const provider = authConfig.providers[0] as any
      const result = await provider.authorize({})
      expect(result).toBeNull()
    })

    it('authorize returns null when email is not a string', async () => {
      const provider = authConfig.providers[0] as any
      const result = await provider.authorize({
        email: 123,
        password: 'password123',
      })
      expect(result).toBeNull()
    })

    it('authorize returns null when password is not a string', async () => {
      const provider = authConfig.providers[0] as any
      const result = await provider.authorize({
        email: 'test@example.com',
        password: 123,
      })
      expect(result).toBeNull()
    })
  })
})
