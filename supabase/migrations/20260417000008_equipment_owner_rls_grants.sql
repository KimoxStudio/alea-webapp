ALTER TABLE "public"."equipment" OWNER TO "postgres";
ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_admin_delete" ON "public"."equipment" FOR DELETE TO "authenticated" USING ("public"."is_admin"());
CREATE POLICY "equipment_admin_insert" ON "public"."equipment" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());
CREATE POLICY "equipment_admin_update" ON "public"."equipment" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());
CREATE POLICY "equipment_select" ON "public"."equipment" FOR SELECT TO "authenticated" USING (true);

GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";
