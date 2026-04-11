import { NextResponse } from 'next/server'
import { cancelExpiredPendingReservations } from '@/lib/server/reservations-service'

async function handleCronRequest(request: Request) {
  const auth = request.headers.get('Authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const cancelled = await cancelExpiredPendingReservations()
    return NextResponse.json({ cancelled })
  } catch (err) {
    console.error('cron/cancel-pending failed', {
      error: err instanceof Error ? err.name : 'UnknownError',
      ...(process.env.NODE_ENV !== 'production' && {
        detail: err instanceof Error ? err.message : String(err),
      }),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Vercel Cron sends GET requests to the configured path.
export async function GET(request: Request) {
  return handleCronRequest(request)
}

export async function POST(request: Request) {
  return handleCronRequest(request)
}
