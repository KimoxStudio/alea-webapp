import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core'
import { roleEnum } from './enums'

/**
 * public.profiles — member/admin identity table.
 *
 * Supabase-era `id` referenced `auth.users(id) ON DELETE CASCADE` (a Supabase
 * Auth-managed table with no Drizzle/Neon equivalent). That FK is intentionally
 * NOT translated here — see docs/MIGRATION-F1-DRIZZLE-COVERAGE.md, "Supabase
 * Auth linkage" ambiguity. Under the target Auth.js stack, `profiles` becomes
 * the root identity table; how `id` is populated (app-generated default vs.
 * assigned at signup) is for KIM-416 (Auth.js) to decide, not this schema.
 *
 * Trigger `profiles_updated_at` (BEFORE UPDATE -> handle_updated_at()) has no
 * Drizzle schema-builder equivalent (no trigger support) — see coverage doc.
 */
export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    memberNumber: varchar('member_number', { length: 20 }).notNull().unique(),
    email: text('email'),
    role: roleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean('is_active').notNull().default(false),
    noShowCount: integer('no_show_count').notNull().default(0),
    blockedUntil: timestamp('blocked_until', { withTimezone: true }),
    authEmail: text('auth_email').notNull(),
    fullName: text('full_name'),
    activeFrom: timestamp('active_from', { withTimezone: true }),
    pswChanged: timestamp('psw_changed', { withTimezone: true }),
    phone: text('phone'),
  },
  (t) => [uniqueIndex('profiles_auth_email_key').on(t.authEmail)],
)
