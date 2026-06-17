-- KIM-391: Fix multiple_permissive_policies warning on public.profiles.
-- profiles_admin_select and profiles_member_select are both permissive SELECT
-- policies for the authenticated role. Supabase linter flags this as redundant
-- because Postgres ORs all permissive policies — having two is confusing and
-- triggers the warning.
--
-- Fix: drop profiles_admin_select, absorb its condition (internal.is_admin())
-- into profiles_member_select as the first OR branch so admins still see all rows.
-- auth.uid() is also wrapped in SELECT here to satisfy the initplan rule from
-- migration 20260528000001.

DROP POLICY IF EXISTS "profiles_admin_select" ON "public"."profiles";

ALTER POLICY "profiles_member_select" ON "public"."profiles"
  USING ("internal"."is_admin"() OR ("id" = (SELECT "auth"."uid"()) AND "internal"."is_active_member"()));
