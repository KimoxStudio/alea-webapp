import { describe, it, expect } from 'vitest'
import enMessages from '@/messages/en.json'
import esMessages from '@/messages/es.json'

/**
 * Flattens a nested object into a Set of dot-path keys (leaf keys only).
 * For example: { a: { b: 'value' } } becomes { 'a.b' }
 */
function flattenKeysToSet(obj: Record<string, any>, prefix = ''): Set<string> {
  const keys = new Set<string>()

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      // Recurse into nested objects
      const nestedKeys = flattenKeysToSet(value, fullKey)
      nestedKeys.forEach((k) => keys.add(k))
    } else {
      // Leaf key
      keys.add(fullKey)
    }
  }

  return keys
}

describe('i18n parity — en.json vs es.json', () => {
  it('both files have the same total leaf-key count', () => {
    const enKeys = flattenKeysToSet(enMessages)
    const esKeys = flattenKeysToSet(esMessages)

    expect(enKeys.size).toBe(esKeys.size)
    expect(enKeys.size).toBe(391)
  })

  it('Spanish file has all keys present in English file', () => {
    const enKeys = flattenKeysToSet(enMessages)
    const esKeys = flattenKeysToSet(esMessages)

    const missingInEs = Array.from(enKeys).filter((k) => !esKeys.has(k))

    expect(missingInEs).toHaveLength(0)
  })

  it('Spanish file has no extra keys not in English file', () => {
    const enKeys = flattenKeysToSet(enMessages)
    const esKeys = flattenKeysToSet(esMessages)

    const extraInEs = Array.from(esKeys).filter((k) => !enKeys.has(k))

    expect(extraInEs).toHaveLength(0)
  })
})
