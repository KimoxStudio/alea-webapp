// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { toGameTable } from '@/lib/server/tables/table-mappers'
import type { Tables } from '@/lib/supabase/types'

type TableRow = Tables<'tables'>

describe('table mappers', () => {
  describe('toGameTable', () => {
    it('maps a complete table row to GameTable with all fields', () => {
      const row: TableRow = {
        id: 'table-123',
        room_id: 'room-main',
        name: 'Mesa 1',
        type: 'large',
        qr_code: 'QR-MESA-1-001',
        qr_code_inf: 'QR-INF-MESA-1-001',
        pos_x: 100,
        pos_y: 200,
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-06-20T14:30:00.000Z',
      }

      const table = toGameTable(row)

      expect(table).toEqual({
        id: 'table-123',
        roomId: 'room-main',
        name: 'Mesa 1',
        type: 'large',
        qrCode: 'QR-MESA-1-001',
        qrCodeInf: 'QR-INF-MESA-1-001',
        position: { x: 100, y: 200 },
      })
    })

    it('converts snake_case column names to camelCase', () => {
      const row: TableRow = {
        id: 'table-convert',
        room_id: 'room-test',
        name: 'Test Table',
        type: 'small',
        qr_code: 'QR-TEST',
        qr_code_inf: null,
        pos_x: 50,
        pos_y: 75,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      // Verify snake_case to camelCase conversion
      expect(table).toHaveProperty('roomId', 'room-test')
      expect(table).toHaveProperty('qrCode', 'QR-TEST')
      expect(table).toHaveProperty('qrCodeInf', null)
    })

    it('defaults qr_code_inf to null when not provided', () => {
      const row: TableRow = {
        id: 'table-no-inf',
        room_id: 'room-1',
        name: 'No Inf Table',
        type: 'removable_top',
        qr_code: 'QR-MAIN',
        qr_code_inf: null,
        pos_x: 0,
        pos_y: 0,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.qrCodeInf).toBeNull()
    })

    it('defaults qr_code to empty string', () => {
      const row: TableRow = {
        id: 'table-empty-qr',
        room_id: 'room-2',
        name: 'Empty QR Table',
        type: 'small',
        qr_code: '',
        qr_code_inf: null,
        pos_x: 10,
        pos_y: 20,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.qrCode).toBe('')
    })

    it('omits position when pos_x is null', () => {
      const row: TableRow = {
        id: 'table-no-pos-x',
        room_id: 'room-3',
        name: 'No X Position',
        type: 'large',
        qr_code: 'QR-003',
        qr_code_inf: null,
        pos_x: null,
        pos_y: 100,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.position).toBeUndefined()
    })

    it('omits position when pos_y is null', () => {
      const row: TableRow = {
        id: 'table-no-pos-y',
        room_id: 'room-4',
        name: 'No Y Position',
        type: 'small',
        qr_code: 'QR-004',
        qr_code_inf: null,
        pos_x: 50,
        pos_y: null,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.position).toBeUndefined()
    })

    it('omits position when both pos_x and pos_y are null', () => {
      const row: TableRow = {
        id: 'table-no-pos',
        room_id: 'room-5',
        name: 'No Position',
        type: 'removable_top',
        qr_code: 'QR-005',
        qr_code_inf: null,
        pos_x: null,
        pos_y: null,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.position).toBeUndefined()
    })

    it('includes position when both pos_x and pos_y are zero', () => {
      const row: TableRow = {
        id: 'table-zero-pos',
        room_id: 'room-6',
        name: 'Zero Position',
        type: 'large',
        qr_code: 'QR-006',
        qr_code_inf: null,
        pos_x: 0,
        pos_y: 0,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.position).toEqual({ x: 0, y: 0 })
    })

    it('handles all table types', () => {
      const types: Array<'small' | 'large' | 'removable_top'> = ['small', 'large', 'removable_top']

      types.forEach((type) => {
        const row: TableRow = {
          id: `table-${type}`,
          room_id: 'room-types',
          name: `${type} Table`,
          type,
          qr_code: `QR-${type}`,
          qr_code_inf: null,
          pos_x: 100,
          pos_y: 200,
          created_at: '2024-06-20T00:00:00.000Z',
          updated_at: '2024-06-20T00:00:00.000Z',
        }

        const table = toGameTable(row)

        expect(table.type).toBe(type)
      })
    })

    it('preserves large position coordinates', () => {
      const row: TableRow = {
        id: 'table-large-pos',
        room_id: 'room-large',
        name: 'Large Position Table',
        type: 'large',
        qr_code: 'QR-LARGE',
        qr_code_inf: null,
        pos_x: 9999,
        pos_y: 8888,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.position).toEqual({ x: 9999, y: 8888 })
    })

    it('preserves negative position coordinates', () => {
      const row: TableRow = {
        id: 'table-negative-pos',
        room_id: 'room-negative',
        name: 'Negative Position Table',
        type: 'small',
        qr_code: 'QR-NEG',
        qr_code_inf: null,
        pos_x: -50,
        pos_y: -100,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.position).toEqual({ x: -50, y: -100 })
    })

    it('handles qr_code_inf as non-null value', () => {
      const row: TableRow = {
        id: 'table-with-inf',
        room_id: 'room-with-inf',
        name: 'With Inf QR',
        type: 'large',
        qr_code: 'QR-MAIN',
        qr_code_inf: 'QR-INF-VALUE',
        pos_x: 100,
        pos_y: 200,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.qrCodeInf).toBe('QR-INF-VALUE')
    })

    it('creates correct id and roomId mappings', () => {
      const row: TableRow = {
        id: 'mesa-456',
        room_id: 'sala-principal',
        name: 'Mesa Grande',
        type: 'removable_top',
        qr_code: 'QR-MESA-456',
        qr_code_inf: null,
        pos_x: 250,
        pos_y: 350,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const table = toGameTable(row)

      expect(table.id).toBe('mesa-456')
      expect(table.roomId).toBe('sala-principal')
    })

    it('preserves all mapped fields without mutation', () => {
      const row: TableRow = {
        id: 'immutable-table',
        room_id: 'immutable-room',
        name: 'Immutable Mesa',
        type: 'large',
        qr_code: 'QR-IMMUTABLE',
        qr_code_inf: 'QR-INF-IMMUTABLE',
        pos_x: 111,
        pos_y: 222,
        created_at: '2024-06-20T00:00:00.000Z',
        updated_at: '2024-06-20T00:00:00.000Z',
      }

      const originalId = row.id
      const originalRoomId = row.room_id
      const originalName = row.name
      const originalType = row.type

      const table = toGameTable(row)

      // Verify original row was not mutated
      expect(row.id).toBe(originalId)
      expect(row.room_id).toBe(originalRoomId)
      expect(row.name).toBe(originalName)
      expect(row.type).toBe(originalType)

      // Verify mapped table has correct values
      expect(table.id).toBe(originalId)
      expect(table.roomId).toBe(originalRoomId)
      expect(table.name).toBe(originalName)
      expect(table.type).toBe(originalType)
    })
  })
})
