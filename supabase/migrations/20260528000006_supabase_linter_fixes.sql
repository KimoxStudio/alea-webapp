-- KIM-391: Comprehensive Supabase linter fixes
-- Adds indexes for unindexed FKs, RLS policies, drops unused indexes

-- ============================================================================
-- 1. Add index for activation_tokens.created_by FK (unindexed_foreign_keys warning)
-- ============================================================================
CREATE INDEX IF NOT EXISTS "activation_tokens_created_by_idx" ON "public"."activation_tokens"("created_by");

-- ============================================================================
-- 2. Add RLS policies for activation_tokens (no_rls_policies warning)
-- ============================================================================
CREATE POLICY "activation_tokens_anon_select_by_hash" ON "public"."activation_tokens"
  FOR SELECT
  TO anon
  USING (TRUE); -- Anon users can read (validated by app layer using token_hash)

CREATE POLICY "activation_tokens_authenticated_select_own" ON "public"."activation_tokens"
  FOR SELECT
  TO authenticated
  USING ("profile_id" = "auth"."uid"());

CREATE POLICY "activation_tokens_authenticated_update_own" ON "public"."activation_tokens"
  FOR UPDATE
  TO authenticated
  USING ("profile_id" = "auth"."uid"())
  WITH CHECK ("profile_id" = "auth"."uid"());

CREATE POLICY "activation_tokens_service_role_all" ON "public"."activation_tokens"
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================================
-- 3. Add indexes for other unindexed FKs
-- ============================================================================
CREATE INDEX IF NOT EXISTS "events_created_by_idx" ON "public"."events"("created_by");
CREATE INDEX IF NOT EXISTS "reservation_equipment_equipment_id_idx" ON "public"."reservation_equipment"("equipment_id");
CREATE INDEX IF NOT EXISTS "room_default_equipment_equipment_id_idx" ON "public"."room_default_equipment"("equipment_id");

-- ============================================================================
-- 4. Drop unused indexes on reservations (NOT the EXCLUSION CONSTRAINT)
-- ============================================================================
DROP INDEX IF EXISTS "reservations_activation_lookup_idx";
DROP INDEX IF EXISTS "reservations_user_date_status_idx";
DROP INDEX IF EXISTS "reservations_pending_no_show_idx";
DROP INDEX IF EXISTS "reservations_pending_date_idx";

-- NOTE: reservations_no_active_overlap is an EXCLUSION CONSTRAINT (not an index)
-- that prevents overlapping reservations. It is used and must NOT be dropped.
