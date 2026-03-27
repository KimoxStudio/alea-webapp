import { NextResponse } from 'next/server'
import type { GameTable } from '@alea/types'

function generateTables(roomId: string, count: number): GameTable[] {
  const types = ['small', 'large', 'removable_top'] as const
  return Array.from({ length: count }, (_, i) => ({
    id: `r${roomId}t${i + 1}`,
    roomId,
    name: `Mesa ${i + 1}`,
    type: types[i % 3],
    qrCode: `QR_R${roomId}T${i + 1}`,
    position: { x: i % 3, y: Math.floor(i / 3) },
  }))
}

const MOCK_TABLES: Record<string, GameTable[]> = {
  '1': generateTables('1', 8),
  '2': generateTables('2', 6),
  '3': generateTables('3', 10),
  '4': generateTables('4', 4),
  '5': generateTables('5', 6),
  '6': generateTables('6', 5),
}

// Add specific reservable entries to room 1 for demo
MOCK_TABLES['1'][0] = { ...MOCK_TABLES['1'][0], id: 't1', type: 'large' }
MOCK_TABLES['1'][2] = { ...MOCK_TABLES['1'][2], id: 't3', type: 'removable_top' }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return NextResponse.json(MOCK_TABLES[id] ?? [])
}
