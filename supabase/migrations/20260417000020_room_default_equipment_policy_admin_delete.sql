CREATE POLICY "room_default_equipment_admin_delete" ON "public"."room_default_equipment" FOR DELETE TO "authenticated" USING ("public"."is_admin"());
