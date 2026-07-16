import 'server-only'
import { del, put } from '@vercel/blob'
import type {
  StorageErrorDetail,
  StorageOperationResult,
  StoragePublicUrlResult,
  StorageUploadOptions,
} from './index'

/**
 * lib/storage/qr/vercel-blob — Vercel Blob-backed implementation of the same
 * seam interface exposed by lib/storage/qr/index.ts.
 *
 * This is an F3 parallel-buildable scaffold (see docs/MIGRATION-supabase-to-neon.md):
 * it implements the storage seam's exact function signatures
 * (`uploadToStorage`, `getPublicStorageUrl`, `removeFromStorage`) against
 * Vercel Blob so a later, explicit cutover step can swap the active backend
 * without touching call sites. This module is intentionally NOT imported or
 * wired in anywhere yet — lib/storage/qr/index.ts (Supabase Storage) remains
 * the sole active implementation. Activation is out of scope here; it
 * belongs to the real F3 cutover, which is a separate, user/infra-gated
 * change (requires a live Vercel Blob store + `BLOB_READ_WRITE_TOKEN`).
 *
 * Vercel Blob has no "bucket" concept — a read-write token is scoped to a
 * single store with a flat pathname namespace. To preserve call-site parity
 * with the Supabase-backed implementation (which takes a `bucket` and a
 * `path`), this adapter joins the two into a single blob pathname
 * (`${bucket}/${path}`), so callers can be swapped over unchanged.
 *
 * `put()`/`del()` below use the default `BLOB_READ_WRITE_TOKEN` env var
 * (Vercel's standard SDK convention) rather than accepting a client instance,
 * since `@vercel/blob` exposes module-level functions instead of a
 * client/from() builder like `@supabase/storage-js`.
 */

function toPathname(bucket: string, path: string): string {
  return `${bucket.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

/**
 * Extracts structured diagnostic fields from a Vercel Blob error without
 * leaking a non-serializable error instance across the seam boundary.
 * Mirrors `toStorageErrorDetail()` in lib/storage/qr/index.ts so both
 * backends surface the same `{ message, name, status, statusCode }` shape.
 */
function toStorageErrorDetail(error: unknown): StorageErrorDetail | null {
  if (!error) return null

  if (typeof error === 'object') {
    const candidate = error as { message?: unknown; name?: unknown; status?: unknown; statusCode?: unknown }
    return {
      message: typeof candidate.message === 'string' ? candidate.message : String(error),
      name: typeof candidate.name === 'string' ? candidate.name : undefined,
      status: typeof candidate.status === 'number' ? candidate.status : undefined,
      statusCode: typeof candidate.statusCode === 'string' ? candidate.statusCode : undefined,
    }
  }

  return { message: String(error) }
}

/**
 * Uploads a file body to Vercel Blob under `${bucket}/${path}`. Wraps
 * `put()` from `@vercel/blob`. All objects are uploaded with `access:
 * 'public'`, matching today's public QR/landing-media buckets on Supabase
 * Storage. `options.upsert` maps to Blob's `allowOverwrite`.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array,
  options: StorageUploadOptions = {},
): Promise<StorageOperationResult> {
  try {
    const blobBody = Buffer.isBuffer(body) ? body : Buffer.from(body)
    await put(toPathname(bucket, path), blobBody, {
      access: 'public',
      contentType: options.contentType,
      allowOverwrite: options.upsert ?? false,
    })

    return { error: null }
  } catch (error) {
    return { error: toStorageErrorDetail(error) }
  }
}

/**
 * Resolves the public URL for an object at `${bucket}/${path}`.
 *
 * Unlike Supabase Storage's `getPublicUrl()`, Vercel Blob does not expose a
 * synchronous, offline URL-construction helper — the canonical URL is only
 * returned by `put()`/`head()` at request time. To preserve this seam
 * method's synchronous signature, the public base URL is read from
 * `BLOB_PUBLIC_BASE_URL` (the store's stable public base, e.g.
 * `https://<store-id>.public.blob.vercel-storage.com`), which the real F3
 * cutover step is expected to configure. Returns `publicUrl: null` when that
 * env var is unset, matching the Supabase implementation's null-safe return
 * shape.
 */
export function getPublicStorageUrl(bucket: string, path: string): StoragePublicUrlResult {
  const baseUrl = process.env.BLOB_PUBLIC_BASE_URL
  if (!baseUrl) return { publicUrl: null }

  const pathname = toPathname(bucket, path)
  return { publicUrl: `${baseUrl.replace(/\/+$/, '')}/${pathname}` }
}

/**
 * Removes one or more objects (each identified by `bucket` + `path`) from
 * Vercel Blob. Wraps `del()` from `@vercel/blob`.
 */
export async function removeFromStorage(bucket: string, paths: string[]): Promise<StorageOperationResult> {
  try {
    await del(paths.map((path) => toPathname(bucket, path)))
    return { error: null }
  } catch (error) {
    return { error: toStorageErrorDetail(error) }
  }
}
