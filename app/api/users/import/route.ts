import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'
import { importMembersFromSource } from '@/lib/server/users-service'

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_EXTENSIONS = new Set(['csv', 'xlsx', 'odt'])
const ACCEPTED_CONTENT_TYPES_BY_EXTENSION: Record<string, Set<string>> = {
  csv: new Set(['text/csv', 'application/csv', 'application/vnd.ms-excel']),
  xlsx: new Set(['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  odt: new Set(['application/vnd.oasis.opendocument.text']),
}

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) ?? '' : ''
}

function isAcceptedUpload(fileName: string, contentType: string) {
  const extension = getFileExtension(fileName)
  if (!ACCEPTED_EXTENSIONS.has(extension)) return false
  if (!contentType) return true
  return ACCEPTED_CONTENT_TYPES_BY_EXTENSION[extension]?.has(contentType) ?? false
}

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (
      !file
      || typeof file === 'string'
      || typeof file.arrayBuffer !== 'function'
      || typeof file.name !== 'string'
      || typeof file.size !== 'number'
    ) {
      return admin.applyCookies(
        NextResponse.json({ message: 'Import source file is required', statusCode: 400 }, { status: 400 })
      )
    }

    if (file.size <= 0 || file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      return admin.applyCookies(
        NextResponse.json({ message: 'Import file must be between 1 byte and 5 MB', statusCode: 400 }, { status: 400 })
      )
    }

    if (!isAcceptedUpload(file.name, file.type)) {
      return admin.applyCookies(
        NextResponse.json({ message: 'Unsupported import file type. Upload CSV, XLSX, or ODT.', statusCode: 400 }, { status: 400 })
      )
    }

    const bytes = new Uint8Array(await file.arrayBuffer())

    if (bytes.byteLength === 0) {
      return admin.applyCookies(
        NextResponse.json({ message: 'Import file is empty', statusCode: 400 }, { status: 400 })
      )
    }

    return admin.applyCookies(NextResponse.json(await importMembersFromSource({
      fileName: file.name,
      contentType: file.type,
      bytes,
    })))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
