import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/server/auth'
import { getCurrentUser } from '@/lib/server/auth-service'
import { toServiceErrorResponse } from '@/lib/server/http-error'

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(getCurrentUser(getSessionFromRequest(request)))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
