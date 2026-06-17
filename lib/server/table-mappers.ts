import 'server-only'
import type { GameTable } from '@/lib/types'
import type { Tables } from '@/lib/supabase/types'

type TableRow = Tables<'tables'>

export function toGameTable(row: TableRow): GameTable {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    type: row.type,
    qrCode: row.qr_code ?? '',
    qrCodeInf: row.qr_code_inf ?? null,
    position: row.pos_x == null || row.pos_y == null ? undefined : { x: row.pos_x, y: row.pos_y },
  }
}
