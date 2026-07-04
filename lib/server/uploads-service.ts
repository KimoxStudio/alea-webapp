import 'server-only'
import { createSupabaseServerAdminClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { SessionUser } from '@/lib/server/auth'

// ---------------------------------------------------------------------------
// Image uploads to Supabase Storage (OIR-207)
//
// Privilege checks (role === 'admin') live here in the service layer, not in
// the route handler, same pattern as the other admin services. Writes always
// go through the service_role client — the "landing-media" bucket has no
// client INSERT policy (see supabase/migrations/20260704000005).
// ---------------------------------------------------------------------------

const LANDING_MEDIA_BUCKET = 'landing-media'
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

// Extension is derived from the (validated) MIME type, never from the
// caller-supplied filename — an attacker-controlled filename must never
// influence the stored object's extension/content-type handling.
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export type UploadFolder = 'events' | 'partners' | 'library-games'
const ALLOWED_FOLDERS = new Set<UploadFolder>(['events', 'partners', 'library-games'])

function requireAdminSession(session: SessionUser): void {
  if (session.role !== 'admin') serviceError('Forbidden', 403)
}

/**
 * Minimal shape we need from the multipart "file" field — matches the Web
 * File/Blob API surface without depending on the DOM lib's `File` type,
 * which isn't guaranteed in the Node server runtime.
 */
export interface UploadFileLike {
  size: number
  type: string
  arrayBuffer: () => Promise<ArrayBuffer>
}

export interface UploadInput {
  file: UploadFileLike | null
  folder: unknown
}

function requireValidFolder(folder: unknown): UploadFolder {
  if (typeof folder !== 'string' || !ALLOWED_FOLDERS.has(folder as UploadFolder)) {
    serviceError('folder must be one of: events, partners, library-games', 400)
  }
  return folder as UploadFolder
}

function requireValidFile(file: UploadFileLike | null): { file: UploadFileLike; extension: string } {
  if (!file) serviceError('file is required', 400)

  const extension = MIME_TO_EXTENSION[file.type]
  if (!extension) {
    serviceError('file must be one of: image/png, image/jpeg, image/webp, image/gif', 400)
  }

  // NOTE: by the time we get here, request.formData() has already buffered
  // the entire multipart body into memory — this check is a validation gate
  // on the parsed size, not a memory-exhaustion defense. Request size is
  // bounded upstream by requireAdmin() (auth-gated) and the adminMutation
  // rate limit; the "landing-media" bucket's file_size_limit is what
  // actually enforces the 5 MB cap at the storage layer.
  if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE_BYTES) {
    serviceError('file must be between 1 byte and 5 MB', 400)
  }

  return { file, extension }
}

/**
 * Validate and upload an admin-supplied image to the "landing-media" bucket,
 * returning its public URL. Used to back the image field of club events,
 * partners and library games from the admin dashboard.
 */
export async function uploadLandingMediaImage(session: SessionUser, input: UploadInput): Promise<{ url: string }> {
  requireAdminSession(session)

  const folder = requireValidFolder(input.folder)
  const { file, extension } = requireValidFile(input.file)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const objectPath = `${folder}/${crypto.randomUUID()}.${extension}`

  const admin = createSupabaseServerAdminClient()
  const { error } = await admin.storage
    .from(LANDING_MEDIA_BUCKET)
    .upload(objectPath, bytes, { contentType: file.type, upsert: false })

  if (error) {
    // Do NOT swallow the underlying storage error — log it server-side so
    // failures (misconfigured bucket, storage outage, etc.) are diagnosable.
    // Only a generic message is ever returned to the client.
    console.error('[uploads-service] Supabase Storage upload failed:', error.message)
    serviceError('Internal server error', 500)
  }

  const { data: publicUrlData } = admin.storage.from(LANDING_MEDIA_BUCKET).getPublicUrl(objectPath)
  if (!publicUrlData?.publicUrl) {
    console.error('[uploads-service] getPublicUrl returned no publicUrl for', objectPath)
    serviceError('Internal server error', 500)
  }

  return { url: publicUrlData.publicUrl }
}
