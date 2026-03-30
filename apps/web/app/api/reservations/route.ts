import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/service-error'
import { createReservationForSession, listVisibleReservations } from '@/lib/server/reservations-service'

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  return NextResponse.json(
    listVisibleReservations({
      session: auth,
      userId: searchParams.get('userId'),
      tableId: searchParams.get('tableId'),
      date: searchParams.get('date'),
    }),
  )
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  try {
    const body = await request.json()
    return NextResponse.json(createReservationForSession(auth, body), { status: 201 })
  } catch (error) {
    return toServiceErrorResponse(error)
  }
}
