import { NextRequest, NextResponse } from 'next/server'
import { clearSessionCookie, enforceSameOriginForMutation } from '@/lib/server/auth'
import { logout } from '@/lib/server/auth-service'

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  const response = NextResponse.json(logout())
  clearSessionCookie(response)
  return response
}
