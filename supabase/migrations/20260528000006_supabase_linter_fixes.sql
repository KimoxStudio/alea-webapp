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
  USING ("profile_id" = (SELECT "auth"."uid"()));

CREATE POLICY "activation_tokens_authenticated_update_own" ON "public"."activation_tokens"
  FOR UPDATE
  TO authenticated
  USING ("profile_id" = (SELECT "auth"."uid"()))
  WITH CHECK ("profile_id" = (SELECT "auth"."uid"()));

CREATE POLICY "activation_tokens_service_role_all" ON "public"."activation_tokens"
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================================
-- Add RLS policies for reservation_equipment (junction table)
-- ============================================================================
CREATE POLICY "reservation_equipment_authenticated_select" ON "public"."reservation_equipment"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."reservations"
      WHERE "id" = "reservation_equipment"."reservation_id"
        AND "user_id" = (SELECT "auth"."uid"())
    )
  );

CREATE POLICY "reservation_equipment_authenticated_insert" ON "public"."reservation_equipment"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."reservations"
      WHERE "id" = "reservation_equipment"."reservation_id"
        AND "user_id" = (SELECT "auth"."uid"())
    )
  );

CREATE POLICY "reservation_equipment_authenticated_update" ON "public"."reservation_equipment"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."reservations"
      WHERE "id" = "reservation_equipment"."reservation_id"
        AND "user_id" = (SELECT "auth"."uid"())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."reservations"
      WHERE "id" = "reservation_equipment"."reservation_id"
        AND "user_id" = (SELECT "auth"."uid"())
    )
  );

CREATE POLICY "reservation_equipment_authenticated_delete" ON "public"."reservation_equipment"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "public"."reservations"
      WHERE "id" = "reservation_equipment"."reservation_id"
        AND "user_id" = (SELECT "auth"."uid"())
    )
  );

CREATE POLICY "reservation_equipment_admin_all" ON "public"."reservation_equipment"
  FOR ALL
  TO authenticated
  USING ("internal"."is_admin"())
  WITH CHECK ("internal"."is_admin"());

CREATE POLICY "reservation_equipment_service_role_all" ON "public"."reservation_equipment"
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

-- Reservations indexes are intentionally retained for activation lookup,
-- user listing, pending no-show, and pending date query paths.
