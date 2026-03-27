import { NextRequest, NextResponse } from 'next/server'
import type { TableAvailability, TimeSlot } from '@alea/types'

function generateDaySlots(reservedSlots: Array<{ start: string; end: string }>): TimeSlot[] {
  return Array.from({ length: 13 }, (_, i) => {
    const h = 9 + i
    const time = `${String(h).padStart(2, '0')}:00`
    const nextTime = `${String(h + 1).padStart(2, '0')}:00`
    const isReserved = reservedSlots.some(r => r.start <= time && r.end > time)
    return { startTime: time, endTime: nextTime, available: !isReserved }
  })
}

const DEMO_RESERVED: Record<string, Array<{ start: string; end: string; surface?: string }>> = {
  't1': [{ start: '16:00', end: '18:00' }],
  't3': [{ start: '10:00', end: '12:00', surface: 'top' }],
}

const REMOVABLE_TOP_IDS = new Set(['t3', 't6'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const date = new URL(request.url).searchParams.get('date') ?? new Date().toISOString().split('T')[0]
  const reserved = DEMO_RESERVED[id] ?? []

  const availability: TableAvailability = {
    tableId: id,
    date,
    slots: generateDaySlots(reserved),
  }

  if (REMOVABLE_TOP_IDS.has(id)) {
    const topReserved = reserved.filter(r => !r.surface || r.surface === 'top')
    const bottomReserved = reserved.filter(r => r.surface === 'bottom')
    availability.top = generateDaySlots(topReserved)
    availability.bottom = generateDaySlots(bottomReserved)
    availability.conflicts = generateDaySlots(reserved)
  }

  return NextResponse.json(availability)
}
