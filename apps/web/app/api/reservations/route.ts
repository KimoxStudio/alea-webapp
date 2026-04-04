import { NextRequest, NextResponse } from 'next/server'
import { enforceSameOriginForMutation, requireAuth } from '@/lib/server/auth'
import { toServiceErrorResponse } from '@/lib/server/http-error'
import { createReservationForSession, listVisibleReservations } from '@/lib/server/reservations-service'

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  return auth.applyCookies(NextResponse.json(
    await listVisibleReservations({
      session: auth.session,
      userId: searchParams.get('userId'),
      tableId: searchParams.get('tableId'),
      date: searchParams.get('date'),
    }),
  ))
}

export async function POST(request: NextRequest) {
  const originError = enforceSameOriginForMutation(request)
  if (originError) return originError

  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    return auth.applyCookies(NextResponse.json(
      await createReservationForSession(auth.session, body),
      { status: 201 },
    ))
  } catch (error) {
    return auth.applyCookies(toServiceErrorResponse(error))
  }
}
