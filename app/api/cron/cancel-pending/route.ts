import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Endpoint deprecated',
      message: 'Cron-based auto-cancellation replaced with lazy evaluation at query time (KIM-366)',
    },
    { status: 410 },
  )
}
