import { describe, it, expect } from 'vitest'
import { validatePassword } from '@/lib/validations/password'

describe('validatePassword', () => {
  it('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Shor1A')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  it('rejects passwords without lowercase letters', () => {
    const result = validatePassword('VALID123')
    expect(result.valid).toBe(false)
  })

  it('rejects passwords without uppercase letters', () => {
    const result = validatePassword('valid123')
    expect(result.valid).toBe(false)
  })

  it('rejects passwords without numbers', () => {
    const result = validatePassword('ValidPass')
    expect(result.valid).toBe(false)
  })

  it('rejects passwords with non-alphanumeric characters', () => {
    const result = validatePassword('Valid123!')
    expect(result.valid).toBe(false)
  })

  it('accepts valid passwords', () => {
    const result = validatePassword('Secure123')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })
})
