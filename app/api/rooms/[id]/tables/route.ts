import { NextRequest, NextResponse } from 'next/server'
import { listRoomTables, createTableEntry } from '@/lib/server/rooms-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { requireAdmin, requireAuth } from '@/lib/server/auth'
import { enforceMutationSecurity, enforceRateLimit, RATE_LIMIT_POLICIES } from '@/lib/server/security'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    return auth.applyCookies(NextResponse.json(await listRoomTables(id)))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const securityError = enforceMutationSecurity(request)
  if (securityError) return securityError

  const rateLimitError = enforceRateLimit(request, RATE_LIMIT_POLICIES.adminMutation)
  if (rateLimitError) return rateLimitError

  const admin = await requireAdmin(request)
  if (admin instanceof NextResponse) return admin

  try {
    const [{ id }, body] = await Promise.all([params, request.json()])
    return admin.applyCookies(NextResponse.json(await createTableEntry(id, body), { status: 201 }))
  } catch (error) {
    return admin.applyCookies(toServiceErrorResponse(error))
  }
}
