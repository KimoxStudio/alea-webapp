CREATE POLICY "equipment_admin_insert" ON "public"."equipment" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());
