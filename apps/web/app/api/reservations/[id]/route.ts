import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { updateReservationForSession } from '@/lib/server/reservations-service'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const { id } = await params
    const body = await request.json()
    return auth.applyCookies(NextResponse.json(await updateReservationForSession(auth.session, id, body)))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
