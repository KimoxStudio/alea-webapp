import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'
import { importMembersFromCsv } from '@/lib/server/users-service'

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ACCEPTED_EXTENSIONS = new Set(['csv'])

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) ?? '' : ''
}

function isAcceptedUpload(fileName: string, contentType: string) {
  const extension = getFileExtension(fileName)
  if (!ACCEPTED_EXTENSIONS.has(extension)) return false
  if (!contentType) return true
  return contentType === 'text/csv' || contentType === 'application/csv' || contentType === 'application/vnd.ms-excel'
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
      || typeof file.text !== 'function'
      || typeof file.name !== 'string'
      || typeof file.size !== 'number'
    ) {
      return admin.applyCookies(
        NextResponse.json({ message: 'CSV file is required', statusCode: 400 }, { status: 400 })
      )
    }

    if (file.size <= 0 || file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      return admin.applyCookies(
        NextResponse.json({ message: 'Import file must be between 1 byte and 5 MB', statusCode: 400 }, { status: 400 })
      )
    }

    if (!isAcceptedUpload(file.name, file.type)) {
      return admin.applyCookies(
        NextResponse.json({ message: 'Unsupported import file type. Upload a CSV export.', statusCode: 400 }, { status: 400 })
      )
    }

    const contents = (await file.text()).trim()

    if (!contents) {
      return admin.applyCookies(
        NextResponse.json({ message: 'Import file is empty', statusCode: 400 }, { status: 400 })
      )
    }

    return admin.applyCookies(NextResponse.json(await importMembersFromCsv(contents)))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
