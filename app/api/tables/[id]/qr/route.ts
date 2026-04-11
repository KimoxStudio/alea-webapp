import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { regenerateQrCodes } from '@/lib/server/tables-service'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  if (auth.session.role !== 'admin') {
    return auth.applyCookies(NextResponse.json({ message: 'Forbidden', statusCode: 403 }, { status: 403 }))
  }

  try {
    const { id: tableId } = await params
    const { qr_code, qr_code_inf } = await regenerateQrCodes(tableId)
    return auth.applyCookies(NextResponse.json({ qr_code, qr_code_inf }))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
