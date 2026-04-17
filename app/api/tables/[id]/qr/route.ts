import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { regenerateQrCodes } from '@/lib/server/tables-service'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const { id: tableId } = await params
    const { qr_code, qr_code_inf } = await regenerateQrCodes(tableId)
    return admin.applyCookies(NextResponse.json({ qr_code, qr_code_inf }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
