import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseServerAdminClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

/**
 * lib/storage/qr — single seam for Supabase Storage access.
 *
 * This is an F0 abstraction seam (see docs/MIGRATION-supabase-to-neon.md):
 * it introduces indirection with zero behavior change so a later phase (F1+)
 * can swap the underlying storage backend (Supabase Storage -> Vercel Blob)
 * without touching call sites again. For F0 this is intentionally a thin
 * wrapper around today's Supabase Storage admin client calls — not a
 * redesign, and Supabase Storage remains the actual backend for now.
 *
 * NOTE on the directory name: this module is named after the migration
 * issue's original shorthand label ("Storage/QR"), but it also backs the
 * general admin-uploaded landing-media images used by
 * lib/server/uploads/uploads-service.ts — that upload is NOT QR-code related. The
 * directory name is fixed per the tracked migration plan; the exported
 * function names below are intentionally generic/accurate rather than
 * QR-specific, since this seam wraps Storage access for more than QR codes.
 *
 * All Storage writes go through the admin (RLS-bypassing) client, matching
 * the existing call sites this seam replaces.
 */

type StorageClient = SupabaseClient<Database>['storage']

export interface StorageUploadOptions {
  contentType?: string
  upsert?: boolean
}

/**
 * Structured diagnostic detail preserved from a Supabase Storage error.
 * Mirrors the fields exposed by `StorageError`/`StorageApiError` in
 * @supabase/storage-js (`name`, `message`, `status`, `statusCode`) so
 * server-side logs can distinguish bucket misconfiguration, permissions,
 * quota, and backend-outage failures instead of collapsing every failure
 * down to a bare message string.
 */
export interface StorageErrorDetail {
  message: string
  name?: string
  status?: number
  statusCode?: string
}

export interface StorageOperationResult {
  error: StorageErrorDetail | null
}

export interface StoragePublicUrlResult {
  publicUrl: string | null
}

function getAdminStorage(): StorageClient {
  return createSupabaseServerAdminClient().storage
}

/**
 * Extracts structured diagnostic fields from a Supabase Storage error
 * without leaking a non-serializable error instance across the seam
 * boundary. Keeps `name`/`status`/`statusCode` when present (as on
 * `StorageError`/`StorageApiError`) so callers can log a fuller diagnostic
 * picture than just `.message`.
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
 * Uploads a file body to the given bucket/path via the admin (RLS-bypassing)
 * Storage client. Wraps `admin.storage.from(bucket).upload(...)`.
 */
export async function uploadToStorage(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array,
  options: StorageUploadOptions = {},
): Promise<StorageOperationResult> {
  const storage = getAdminStorage()
  const { error } = await storage.from(bucket).upload(path, body, {
    contentType: options.contentType,
    upsert: options.upsert ?? false,
  })

  return { error: toStorageErrorDetail(error) }
}

/**
 * Resolves the public URL for an object in the given bucket/path via the
 * admin Storage client. Wraps `admin.storage.from(bucket).getPublicUrl(...)`.
 */
export function getPublicStorageUrl(bucket: string, path: string): StoragePublicUrlResult {
  const storage = getAdminStorage()
  const { data } = storage.from(bucket).getPublicUrl(path)

  return { publicUrl: data?.publicUrl ?? null }
}

/**
 * Removes one or more objects from the given bucket via the admin Storage
 * client. Wraps `admin.storage.from(bucket).remove(...)`. Not currently
 * called by any service, but included so the seam covers the full
 * upload/get-url/delete surface referenced by the migration plan.
 */
export async function removeFromStorage(bucket: string, paths: string[]): Promise<StorageOperationResult> {
  const storage = getAdminStorage()
  const { error } = await storage.from(bucket).remove(paths)

  return { error: toStorageErrorDetail(error) }
}
