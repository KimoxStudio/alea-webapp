CREATE POLICY "equipment_admin_delete" ON "public"."equipment" FOR DELETE TO "authenticated" USING ("public"."is_admin"());
