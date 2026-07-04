-- OIR-202: repair remote state where migration
-- 20260703000001_oir202_extend_events_for_public_landing.sql is recorded as
-- already applied (present in the remote migration history), but its
-- anon GRANT/policy never actually took effect on the remote database
-- (anon SELECT on public.events currently fails with 42501 permission
-- denied, even though the added columns and seed data ARE present).
--
-- This happened due to a migration-history rewrite on this branch: the
-- remote's schema_migrations bookkeeping shows 20260703000001 as applied,
-- so `supabase db push` will not re-run it, leaving anon without the SELECT
-- grant and without the "events_select_public" policy. This migration is a
-- standalone, idempotent repair that re-applies only the grant/policy
-- portion of 20260703000001 — no column changes, no seed data, no other
-- grants.
GRANT SELECT ON TABLE "public"."events" TO "anon";

DROP POLICY IF EXISTS "events_select_public" ON "public"."events";

CREATE POLICY "events_select_public" ON "public"."events"
  FOR SELECT TO "anon"
  USING ("title_es" IS NOT NULL AND "title_en" IS NOT NULL);
