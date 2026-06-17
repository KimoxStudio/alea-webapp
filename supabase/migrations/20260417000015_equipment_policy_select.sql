CREATE POLICY "equipment_select" ON "public"."equipment" FOR SELECT TO "authenticated" USING (true);
