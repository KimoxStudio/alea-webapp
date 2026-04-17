CREATE POLICY "room_default_equipment_select" ON "public"."room_default_equipment" FOR SELECT TO "authenticated" USING (true);
