/**
 * KIM-409: Verify error code parity
 *
 * Ensures all ERROR_CODES values match their key strings.
 * Client-side code often compares against literal strings, so values MUST NOT drift.
 */

import { describe, expect, it } from 'vitest'
import { ERROR_CODES } from '@/lib/types/error-codes'

describe('ERROR_CODES parity', () => {
  it('all ERROR_CODES values equal their keys', () => {
    Object.entries(ERROR_CODES).forEach(([key, value]) => {
      expect(value).toBe(key)
    })
  })

  it('critical codes match their expected strings', () => {
    expect(ERROR_CODES.SLOT_TAKEN).toBe('SLOT_TAKEN')
    expect(ERROR_CODES.CHECK_IN_TOO_LATE).toBe('CHECK_IN_TOO_LATE')
    expect(ERROR_CODES.SAVED_GAME_CONFLICT).toBe('SAVED_GAME_CONFLICT')
  })
})
