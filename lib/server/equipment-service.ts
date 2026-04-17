import { createSupabaseServerAdminClient, createSupabaseServerClient } from '@/lib/supabase/server'
import { serviceError } from '@/lib/server/service-error'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'
import type { Equipment } from '@/lib/types'

export type { Equipment }

type EquipmentRow = Tables<'equipment'>
type RoomDefaultEquipmentRow = Tables<'room_default_equipment'>

function toEquipment(row: EquipmentRow): Equipment {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    createdAt: row.created_at,
  }
}

export async function listEquipment(): Promise<Equipment[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('equipment')
    .select('id, name, description, created_at')
    .order('name', { ascending: true })

  if (error) {
    serviceError('Internal server error', 500)
  }

  return ((data ?? []) as EquipmentRow[]).map(toEquipment)
}

export async function createEquipment(body: { name?: unknown; description?: unknown }): Promise<Equipment> {
  const name = String(body.name ?? '').trim()
  if (!name) {
    serviceError('Equipment name is required', 400)
  }

  const supabase = createSupabaseServerAdminClient()
  const insert: TablesInsert<'equipment'> = {
    name,
    description: body.description ? String(body.description) : null,
  }

  const { data, error } = await supabase
    .from('equipment')
    .insert(insert)
    .select('id, name, description, created_at')
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('Internal server error', 500)
  }

  return toEquipment(data as EquipmentRow)
}

export async function updateEquipment(
  id: string,
  body: { name?: unknown; description?: unknown },
): Promise<Equipment> {
  const updates: TablesUpdate<'equipment'> = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) {
      serviceError('Equipment name cannot be empty', 400)
    }
    updates.name = name
  }
  if (body.description !== undefined) {
    updates.description = body.description === null ? null : String(body.description) || null
  }

  if (Object.keys(updates).length === 0) {
    serviceError('No updatable fields provided', 400)
  }

  const supabase = createSupabaseServerAdminClient()
  const { data, error } = await supabase
    .from('equipment')
    .update(updates)
    .eq('id', id)
    .select('id, name, description, created_at')
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('Equipment not found', 404)
  }

  return toEquipment(data as EquipmentRow)
}

export async function deleteEquipment(id: string): Promise<void> {
  const supabase = createSupabaseServerAdminClient()
  const { data, error } = await supabase
    .from('equipment')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    serviceError('Internal server error', 500)
  }
  if (!data) {
    serviceError('Equipment not found', 404)
  }
}

export async function getRoomDefaultEquipment(roomId: string): Promise<Equipment[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('room_default_equipment')
    .select('equipment_id, equipment(id, name, description, created_at)')
    .eq('room_id', roomId)

  if (error) {
    serviceError('Internal server error', 500)
  }

  return ((data ?? []) as Array<RoomDefaultEquipmentRow & { equipment: EquipmentRow | null }>)
    .map((row) => row.equipment)
    .filter((e): e is EquipmentRow => e !== null)
    .map(toEquipment)
}

export async function setRoomDefaultEquipment(roomId: string, equipmentIds: string[]): Promise<void> {
  const supabase = createSupabaseServerAdminClient()

  // Delete existing defaults for this room
  const { error: deleteError } = await supabase
    .from('room_default_equipment')
    .delete()
    .eq('room_id', roomId)

  if (deleteError) {
    serviceError('Internal server error', 500)
  }

  if (equipmentIds.length === 0) {
    return
  }

  const inserts: TablesInsert<'room_default_equipment'>[] = equipmentIds.map((equipment_id) => ({
    room_id: roomId,
    equipment_id,
  }))

  const { error: insertError } = await supabase
    .from('room_default_equipment')
    .insert(inserts)

  if (insertError) {
    serviceError('Internal server error', 500)
  }
}
