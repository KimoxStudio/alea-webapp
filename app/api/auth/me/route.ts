import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    return auth.applyCookies(NextResponse.json(await getCurrentUser(auth.session)))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
