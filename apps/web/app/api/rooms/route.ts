import { NextResponse } from 'next/server'
import type { Room } from '@alea/types'

const MOCK_ROOMS: Room[] = [
  { id: '1', name: 'Sala Mirkwood', tableCount: 8, description: 'Sala principal de rol y estrategia' },
  { id: '2', name: 'Sala Gondolin', tableCount: 6, description: 'Sala de juegos de mesa clasicos' },
  { id: '3', name: 'Sala Khazad-dum', tableCount: 10, description: 'Sala grande para torneos y eventos' },
  { id: '4', name: 'Sala Rivendell', tableCount: 4, description: 'Sala intima para partidas pequenas' },
  { id: '5', name: 'Sala Lothlorien', tableCount: 6, description: 'Sala tematica de fantasia' },
  { id: '6', name: 'Sala Edoras', tableCount: 5, description: 'Sala de wargames y miniaturas' },
]

export async function GET() {
  return NextResponse.json(MOCK_ROOMS)
}

export async function POST(request: Request) {
  const body = await request.json()
  const newRoom: Room = { id: String(Date.now()), name: body.name, tableCount: body.tableCount ?? 0, description: body.description }
  return NextResponse.json(newRoom, { status: 201 })
}
