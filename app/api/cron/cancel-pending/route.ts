import { NextRequest, NextResponse } from 'next/server'
import { cancelExpiredPendingReservations } from '@/lib/server/reservations-service'
import { tokensMatch } from '@/lib/server/security'

async function handleCronRequest(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const secret = process.env.CRON_SECRET
  if (!secret || !authHeader || !authHeader.startsWith('Bearer ') || !tokensMatch(authHeader.slice(7), secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const cancelled = await cancelExpiredPendingReservations()
    console.log(
      JSON.stringify({
        event: 'cron.cancel_expired_pending_reservations',
        timestamp: new Date().toISOString(),
        cancelled,
      }),
    )
    return NextResponse.json({ cancelled })
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'cron.cancel_expired_pending_reservations.error',
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.name : 'UnknownError',
        ...(process.env.NODE_ENV !== 'production' && {
          detail: err instanceof Error ? err.message : String(err),
        }),
      }),
    )
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return handleCronRequest(request)
}
