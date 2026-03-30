import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, setSessionCookie } from '@/lib/server/auth'
import { register } from '@/lib/server/auth-service'
import { toServiceErrorResponse } from '@/lib/server/service-error'

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  try {
    const body = await request.json()
    const user = register(body)
    const response = NextResponse.json(user)
    setSessionCookie(response, user)
    return response
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
