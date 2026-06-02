-- KIM-391: Fix reservation_equipment admin policy binding
-- Admin access must route through service_role client, not authenticated.
-- Change admin_all policy from TO authenticated (which ORs with 4 other policies)
-- to TO service_role, ensuring admin mutations use the dedicated admin client path.

DROP POLICY "reservation_equipment_admin_all" ON "public"."reservation_equipment";

CREATE POLICY "reservation_equipment_admin_all" ON "public"."reservation_equipment"
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
