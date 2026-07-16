import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/** public.rooms (supabase/migrations/20260417000003_baseline.sql) */
export const rooms = pgTable('rooms', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tableCount: integer('table_count').notNull().default(0),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
