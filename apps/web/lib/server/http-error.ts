import { NextResponse } from 'next/server'
import { ServiceError } from '@/lib/server/service-error'

export function toServiceErrorResponse(error: unknown) {
  if (error instanceof ServiceError) {
    return NextResponse.json({ message: error.message, statusCode: error.statusCode }, { status: error.statusCode })
  }

  return NextResponse.json({ message: 'Internal server error', statusCode: 500 }, { status: 500 })
}
