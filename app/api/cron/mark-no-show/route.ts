import { NextRequest, NextResponse } from 'next/server'
import { markNoShowReservations } from '@/lib/server/reservations-service'

async function handleCronRequest(request: NextRequest) {
  const auth = request.headers.get('Authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const marked = await markNoShowReservations()
    console.log(
      JSON.stringify({
        event: 'cron.mark_no_show_reservations',
        timestamp: new Date().toISOString(),
        marked,
      }),
    )
    return NextResponse.json({ marked })
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'cron.mark_no_show_reservations.error',
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
