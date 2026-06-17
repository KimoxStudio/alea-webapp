CREATE POLICY "room_default_equipment_admin_insert" ON "public"."room_default_equipment" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());
