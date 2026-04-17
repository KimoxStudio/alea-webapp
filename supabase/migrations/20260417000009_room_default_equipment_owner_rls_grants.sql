ALTER TABLE "public"."room_default_equipment" OWNER TO "postgres";
ALTER TABLE "public"."room_default_equipment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room_default_equipment_admin_delete" ON "public"."room_default_equipment" FOR DELETE TO "authenticated" USING ("public"."is_admin"());
CREATE POLICY "room_default_equipment_admin_insert" ON "public"."room_default_equipment" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());
CREATE POLICY "room_default_equipment_select" ON "public"."room_default_equipment" FOR SELECT TO "authenticated" USING (true);

GRANT ALL ON TABLE "public"."room_default_equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."room_default_equipment" TO "service_role";
