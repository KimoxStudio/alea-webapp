import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/auth'
import { createRoomEntry, listAllRooms } from '@/lib/server/rooms-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function GET() {
  try {
    return NextResponse.json(await listAllRooms())
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const body = await request.json()
    return admin.applyCookies(NextResponse.json(await createRoomEntry(body), { status: 201 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
