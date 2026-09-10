// Shared byte-level helpers for file-upload validation.
//
// Both `uploads-service.ts` (image magic-byte checks) and `member-import.ts`
// (ZIP signature check for .xlsx/.odt) need to verify that a byte buffer
// starts with a known magic-number prefix. Kept here so a future fix to the
// signature-matching logic only has to happen once.

/** Does `bytes` start with the exact byte sequence `signature`? */
export function startsWithSignature(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, index) => bytes[index] === byte)
}
