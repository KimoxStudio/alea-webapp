import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema, registerServerSchema, passwordSchema } from '@/lib/validations/auth'

describe('Auth validation schemas - error keys (KIM-325)', () => {
  describe('passwordSchema', () => {
    it('validates passwords with all requirements', () => {
      const result = passwordSchema.safeParse('SecurePass123!')
      expect(result.success).toBe(true)
    })

    it('rejects passwords shorter than 12 characters with correct error key', () => {
      const result = passwordSchema.safeParse('Short1!')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('errors.passwordMinLength')
      }
    })

    it('rejects passwords exceeding 1024 characters with correct error key', () => {
      const result = passwordSchema.safeParse('A' + 'a'.repeat(1024) + '1!')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('errors.passwordMaxLength')
      }
    })

    it('rejects passwords without letters with correct error key', () => {
      const result = passwordSchema.safeParse('123456789!@#')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message === 'errors.passwordAlphanumeric')).toBe(true)
      }
    })

    it('rejects passwords without numbers with correct error key', () => {
      const result = passwordSchema.safeParse('ValidPassword!@#')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message === 'errors.passwordAlphanumeric')).toBe(true)
      }
    })

    it('rejects passwords without special characters with correct error key', () => {
      const result = passwordSchema.safeParse('ValidPassword123')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some(issue => issue.message === 'errors.passwordSpecialChar')).toBe(true)
      }
    })
  })

  describe('loginSchema', () => {
    it('validates valid login data', () => {
      const result = loginSchema.safeParse({
        identifier: '100001',
        password: 'SecurePass123!'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing identifier with correct error key', () => {
      const result = loginSchema.safeParse({
        identifier: '',
        password: 'SecurePass123!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'identifier')?.message).toBe('errors.memberNumberRequired')
      }
    })

    it('rejects missing password with correct error key', () => {
      const result = loginSchema.safeParse({
        identifier: '100001',
        password: ''
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'password')?.message).toBe('errors.passwordRequired')
      }
    })

    it('rejects password exceeding max length with correct error key', () => {
      const result = loginSchema.safeParse({
        identifier: '100001',
        password: 'a'.repeat(1025)
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'password')?.message).toBe('errors.passwordMaxLength')
      }
    })
  })

  describe('registerSchema', () => {
    it('validates valid registration data', () => {
      const result = registerSchema.safeParse({
        memberNumber: '100099',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing member number with correct error key', () => {
      const result = registerSchema.safeParse({
        memberNumber: '',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'memberNumber')?.message).toBe('errors.memberNumberRequired')
      }
    })

    it('rejects member number exceeding 20 characters with correct error key', () => {
      const result = registerSchema.safeParse({
        memberNumber: '1'.repeat(21),
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'memberNumber')?.message).toBe('errors.memberNumberTooLong')
      }
    })

    it('rejects member number with non-numeric characters with correct error key', () => {
      const result = registerSchema.safeParse({
        memberNumber: 'ABC123',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'memberNumber')?.message).toBe('errors.memberNumberNumeric')
      }
    })

    it('rejects mismatched passwords with correct error key', () => {
      const result = registerSchema.safeParse({
        memberNumber: '100099',
        password: 'SecurePass123!',
        confirmPassword: 'DifferentPass123!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'confirmPassword')?.message).toBe('errors.passwordsDoNotMatch')
      }
    })

    it('rejects invalid password with correct error key', () => {
      const result = registerSchema.safeParse({
        memberNumber: '100099',
        password: 'Short1!',
        confirmPassword: 'Short1!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'password')?.message).toBe('errors.passwordMinLength')
      }
    })

    it('rejects memberNumber of 11 digits', () => {
      const result = registerSchema.safeParse({
        memberNumber: '12345678901',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'memberNumber')?.message).toBe('errors.memberNumberTooLong')
      }
    })

    it('accepts memberNumber of exactly 10 digits', () => {
      const result = registerSchema.safeParse({
        memberNumber: '1234567890',
        password: 'SecurePass123!',
        confirmPassword: 'SecurePass123!'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('registerServerSchema', () => {
    it('validates valid server registration data', () => {
      const result = registerServerSchema.safeParse({
        memberNumber: '100099',
        password: 'SecurePass123!'
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing member number with correct error key', () => {
      const result = registerServerSchema.safeParse({
        memberNumber: '',
        password: 'SecurePass123!'
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.find(i => i.path[0] === 'memberNumber')?.message).toBe('errors.memberNumberRequired')
      }
    })

    it('does not require confirmPassword on server schema', () => {
      const result = registerServerSchema.safeParse({
        memberNumber: '100099',
        password: 'SecurePass123!'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('Error key format (KIM-325 fix)', () => {
    it('uses errors.* prefix instead of auth.errors.* prefix for all validation errors', () => {
      // Test loginSchema
      const loginResult = loginSchema.safeParse({ identifier: '', password: '' })
      expect(loginResult.success).toBe(false)
      if (!loginResult.success) {
        loginResult.error.issues.forEach(issue => {
          expect(issue.message).toMatch(/^errors\./)
          expect(issue.message).not.toMatch(/^auth\.errors\./)
        })
      }

      // Test registerSchema
      const registerResult = registerSchema.safeParse({
        memberNumber: '',
        password: '',
        confirmPassword: ''
      })
      expect(registerResult.success).toBe(false)
      if (!registerResult.success) {
        registerResult.error.issues.forEach(issue => {
          expect(issue.message).toMatch(/^errors\./)
          expect(issue.message).not.toMatch(/^auth\.errors\./)
        })
      }

      // Test passwordSchema
      const passwordResult = passwordSchema.safeParse('short')
      expect(passwordResult.success).toBe(false)
      if (!passwordResult.success) {
        passwordResult.error.issues.forEach(issue => {
          expect(issue.message).toMatch(/^errors\./)
          expect(issue.message).not.toMatch(/^auth\.errors\./)
        })
      }
    })
  })
})
