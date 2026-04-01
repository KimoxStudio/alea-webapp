import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { updateReservationForSession } from '@/lib/server/reservations-service'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  try {
    const { id } = await params
    const body = await request.json()
    return NextResponse.json(updateReservationForSession(auth, id, body))
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
