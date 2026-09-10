/**
 * Derives Clerk's Frontend API (FAPI) host from the configured publishable
 * key, replicating `parsePublishableKey()` from `@clerk/shared` (see
 * `node_modules/@clerk/shared/dist/keys.js`) without importing Clerk
 * internals into `next.config.ts`.
 *
 * A publishable key is `pk_(test|live)_<base64>`; the base64 segment
 * decodes to the FAPI host followed by a trailing `$`. A `pk_test_*` key
 * decodes to a `*.clerk.accounts.dev` host; a `pk_live_*` key decodes to
 * the app's own configured production Clerk domain. Hardcoding either
 * host is the bug this function exists to avoid — a dev-only host would
 * silently break auth in production, and vice versa.
 *
 * Validation mirrors `@clerk/shared`'s `isValidDecodedPublishableKey`
 * exactly: the decoded value must end with a single trailing `$` (no other
 * `$` before it) and the host portion must contain a `.`.
 */
export function getClerkFrontendApiHost(publishableKey: string | undefined): string | null {
  if (!publishableKey) return null
  if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
    return null
  }

  const encoded = publishableKey.split('_')[2]
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8')

  if (!decoded.endsWith('$')) return null
  const host = decoded.slice(0, -1)
  if (host.includes('$')) return null
  if (!host.includes('.')) return null

  return host
}
