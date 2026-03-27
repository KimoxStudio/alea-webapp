import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authCookie = request.cookies.get('auth_user')
  if (!authCookie) {
    return NextResponse.json({ message: 'Unauthorized', statusCode: 401 }, { status: 401 })
  }
  try {
    return NextResponse.json(JSON.parse(authCookie.value))
  } catch {
    return NextResponse.json({ message: 'Invalid session', statusCode: 401 }, { status: 401 })
  }
}
