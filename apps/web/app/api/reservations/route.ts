import { NextRequest, NextResponse } from 'next/server'
import type { Reservation } from '@alea/types'

const today = new Date().toISOString().split('T')[0]

const MOCK_RESERVATIONS: Reservation[] = [
  { id: 'r1', tableId: 't1', userId: '2', date: today, startTime: '16:00', endTime: '18:00', status: 'active', createdAt: new Date().toISOString() },
  { id: 'r2', tableId: 't3', userId: '2', date: today, startTime: '10:00', endTime: '12:00', status: 'active', surface: 'top', createdAt: new Date().toISOString() },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')
  const tableId = searchParams.get('tableId')
  const date = searchParams.get('date')

  let filtered = [...MOCK_RESERVATIONS]
  if (userId) filtered = filtered.filter(r => r.userId === userId)
  if (tableId) filtered = filtered.filter(r => r.tableId === tableId)
  if (date) filtered = filtered.filter(r => r.date === date)

  return NextResponse.json(filtered)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newReservation: Reservation = {
    id: `r${Date.now()}`,
    tableId: body.tableId,
    userId: body.userId ?? '2',
    date: body.date,
    startTime: body.startTime,
    endTime: body.endTime,
    status: 'active',
    surface: body.surface ?? null,
    createdAt: new Date().toISOString(),
  }
  MOCK_RESERVATIONS.push(newReservation)
  return NextResponse.json(newReservation, { status: 201 })
}
