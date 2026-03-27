import { describe, it, expect } from 'vitest'
import { validatePassword } from '@/lib/validations/password'

describe('validatePassword', () => {
  it('rejects passwords shorter than 12 characters', () => {
    const result = validatePassword('Short1!')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects passwords without special characters', () => {
    const result = validatePassword('ValidPassword12')
    expect(result.valid).toBe(false)
  })

  it('rejects passwords without numbers', () => {
    const result = validatePassword('ValidPassword!@#')
    expect(result.valid).toBe(false)
  })

  it('accepts valid passwords', () => {
    const result = validatePassword('SecurePass123!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts passwords with multiple special chars', () => {
    const result = validatePassword('MyStr0ng!Pass#2')
    expect(result.valid).toBe(true)
  })
})
