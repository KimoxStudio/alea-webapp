import qrcode from 'qrcode'
import type { GameTable } from '@/lib/types'
import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import { resolveDate, buildAvailability } from '@/lib/server/availability'
import type { Tables } from '@/lib/supabase/types'

type TableRow = Tables<'tables'>
type ReservationRow = Tables<'reservations'>

const TABLE_COLUMNS = 'id, room_id, name, type, qr_code, qr_code_inf, pos_x, pos_y'

function toGameTable(row: TableRow): GameTable {
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

async function uploadQrCodeToStorage(
  admin: ReturnType<typeof createSupabaseServerAdminClient>,
  url: string,
  storagePath: string,
): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) serviceError('NEXT_PUBLIC_SUPABASE_URL is not set — cannot build QR code storage URL', 500)

  const buffer = await qrcode.toBuffer(url, { errorCorrectionLevel: 'M', width: 400, type: 'png' })

  const { error: uploadError } = await admin.storage
    .from('table-qr-codes')
    .upload(storagePath, buffer, { contentType: 'image/png', upsert: true })

  if (uploadError) {
    serviceError('Failed to upload QR code to storage', 500)
  }

  return `${supabaseUrl}/storage/v1/object/public/table-qr-codes/${storagePath}`
}

export async function generateTableQrCode(tableId: string): Promise<string> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId)) {
    serviceError('Invalid table ID', 400)
  }
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  if (!appUrl) serviceError('NEXT_PUBLIC_APP_URL is not set — cannot generate QR code URL', 500)
  const url = `${appUrl}/check-in/${tableId}`
  const admin = createSupabaseServerAdminClient()
  return uploadQrCodeToStorage(admin, url, `${tableId}.png`)
}

export async function regenerateQrCodes(tableId: string): Promise<{ qr_code: string; qr_code_inf: string | null }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableId)) {
    serviceError('Invalid table ID', 400)
  }
  const admin = createSupabaseServerAdminClient()

  const { data: table, error: fetchError } = await admin
    .from('tables')
    .select('id, type')
    .eq('id', tableId)
    .maybeSingle()

  if (fetchError) {
    serviceError('Internal server error', 500)
  }
  if (!table) {
    serviceError('Table not found', 404)
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
  if (!appUrl) serviceError('NEXT_PUBLIC_APP_URL is not set — cannot generate QR code URL', 500)

  const [qr_code, qr_code_inf] = await Promise.all([
    uploadQrCodeToStorage(admin, `${appUrl}/check-in/${tableId}`, `${tableId}.png`),
    table!.type === 'removable_top'
      ? uploadQrCodeToStorage(admin, `${appUrl}/check-in/${tableId}?side=inf`, `${tableId}-inf.png`)
      : Promise.resolve(null),
  ])

  const updatePayload: { qr_code: string; qr_code_inf?: string | null } = { qr_code }
  if (table!.type === 'removable_top') {
    updatePayload.qr_code_inf = qr_code_inf
  }

  const { error: updateError } = await admin
    .from('tables')
    .update(updatePayload)
    .eq('id', tableId)

  if (updateError) {
    serviceError('Internal server error', 500)
  }

  return { qr_code, qr_code_inf }
}

export async function getTableAvailability(tableId: string, date?: string | null) {
  const supabase = await createSupabaseServerClient()
  const tableResult = await supabase
    .from('tables')
    .select(TABLE_COLUMNS)
    .eq('id', tableId)
    .maybeSingle()
  const table = tableResult.data as TableRow | null
  const tableError = tableResult.error

  if (tableError) {
    serviceError('Internal server error', 500)
  }
  if (!table) {
    serviceError('Table not found', 404)
  }

  const effectiveDate = resolveDate(date)
  const admin = createSupabaseServerAdminClient()
  const reservationsResult = await admin
    .from('reservations')
    .select('id, table_id, date, start_time, end_time, status, surface, user_id, created_at')
    .eq('table_id', tableId)
    .eq('date', effectiveDate)
    .in('status', ['active', 'pending'])
  const reservations = (reservationsResult.data ?? []) as ReservationRow[]
  const reservationsError = reservationsResult.error

  if (reservationsError) {
    serviceError('Internal server error', 500)
  }

  return buildAvailability(toGameTable(table!), effectiveDate, reservations)
}
