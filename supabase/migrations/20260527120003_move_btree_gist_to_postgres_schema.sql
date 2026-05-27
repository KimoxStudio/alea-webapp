-- Move btree_gist extension from public schema to extensions schema.
-- KIM-391: Fix remaining Supabase security linter warnings.
-- Extensions should be installed in the extensions schema, not public.

DROP EXTENSION IF EXISTS "btree_gist" CASCADE;
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "extensions";

-- Recreate exclusion constraint dropped by CASCADE above.
ALTER TABLE ONLY "public"."reservations"
  ADD CONSTRAINT "reservations_no_active_overlap"
  EXCLUDE USING "gist" (
    "table_id" WITH =,
    tsrange("date" + "start_time", "date" + "end_time", '[)') WITH &&
  ) WHERE (("status" = 'active'::"public"."reservation_status"));
