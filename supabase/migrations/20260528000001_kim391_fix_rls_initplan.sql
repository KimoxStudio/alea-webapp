-- KIM-391: Fix auth_rls_initplan warnings on 5 RLS policies.
-- Wrapping auth.uid() in (SELECT auth.uid()) prevents Postgres from evaluating
-- it as a correlated subplan per row (initplan), enabling index scans instead.
-- Builds on KIM-393 which moved is_admin/is_active_member to internal schema.

-- public.profiles — profiles_member_select
ALTER POLICY "profiles_member_select" ON "public"."profiles"
  USING (("id" = (SELECT "auth"."uid"())) AND "internal"."is_active_member"());

-- public.reservations — reservations_delete
ALTER POLICY "reservations_delete" ON "public"."reservations"
  USING ((("user_id" = (SELECT "auth"."uid"())) AND "internal"."is_active_member"()) OR "internal"."is_admin"());

-- public.reservations — reservations_insert
ALTER POLICY "reservations_insert" ON "public"."reservations"
  WITH CHECK ((("user_id" = (SELECT "auth"."uid"())) AND "internal"."is_active_member"()) OR "internal"."is_admin"());

-- public.reservations — reservations_select
ALTER POLICY "reservations_select" ON "public"."reservations"
  USING ((("user_id" = (SELECT "auth"."uid"())) AND "internal"."is_active_member"()) OR "internal"."is_admin"());

-- public.reservations — reservations_update (both USING and WITH CHECK)
ALTER POLICY "reservations_update" ON "public"."reservations"
  USING ((("user_id" = (SELECT "auth"."uid"())) AND "internal"."is_active_member"()) OR "internal"."is_admin"())
  WITH CHECK ((("user_id" = (SELECT "auth"."uid"())) AND "internal"."is_active_member"()) OR "internal"."is_admin"());
