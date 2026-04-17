CREATE POLICY "equipment_admin_update" ON "public"."equipment" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());
