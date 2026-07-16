import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { tableTypeEnum } from './enums'
import { rooms } from './rooms'

/**
 * public.tables — physical gaming tables inside a room.
 * (supabase/migrations/20260417000003_baseline.sql,
 *  20260417000007_fix_double_table_qr_code_inf.sql — data-only, no schema change)
 */
export const tables = pgTable(
  'tables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: tableTypeEnum('type').notNull().default('small'),
    qrCode: text('qr_code'),
    posX: integer('pos_x'),
    posY: integer('pos_y'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    qrCodeInf: text('qr_code_inf'),
  },
  (t) => [index('tables_room_id_idx').on(t.roomId)],
)
