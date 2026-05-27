-- KIM-393: Move RLS helper functions to internal schema (security hardening)
-- Removes is_admin() and is_active_member() from public schema exposure.
-- These functions are called only by RLS policies (server-side), not via API.
-- Moving to internal schema removes them from PostgREST /rpc/ exposure.

-- Create internal schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS "internal";

-- Recreate is_active_member in internal schema
CREATE OR REPLACE FUNCTION "internal"."is_active_member"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'internal', 'public', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
$$;

ALTER FUNCTION "internal"."is_active_member"() OWNER TO "postgres";

-- Recreate is_admin in internal schema
CREATE OR REPLACE FUNCTION "internal"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'internal', 'public', 'pg_catalog'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

ALTER FUNCTION "internal"."is_admin"() OWNER TO "postgres";

-- Update all RLS policies to call internal.is_admin() instead of public.is_admin()
ALTER POLICY "event_room_blocks_admin_delete" ON "public"."event_room_blocks" USING ("internal"."is_admin"());
ALTER POLICY "event_room_blocks_admin_insert" ON "public"."event_room_blocks" WITH CHECK ("internal"."is_admin"());
ALTER POLICY "event_room_blocks_admin_update" ON "public"."event_room_blocks" USING ("internal"."is_admin"()) WITH CHECK ("internal"."is_admin"());

ALTER POLICY "events_admin_delete" ON "public"."events" USING ("internal"."is_admin"());
ALTER POLICY "events_admin_insert" ON "public"."events" WITH CHECK ("internal"."is_admin"());
ALTER POLICY "events_admin_update" ON "public"."events" USING ("internal"."is_admin"()) WITH CHECK ("internal"."is_admin"());

ALTER POLICY "profiles_admin_delete" ON "public"."profiles" USING ("internal"."is_admin"());
ALTER POLICY "profiles_admin_insert" ON "public"."profiles" WITH CHECK ("internal"."is_admin"());
ALTER POLICY "profiles_admin_select" ON "public"."profiles" USING ("internal"."is_admin"());
ALTER POLICY "profiles_admin_update" ON "public"."profiles" USING ("internal"."is_admin"()) WITH CHECK ("internal"."is_admin"());

ALTER POLICY "profiles_member_select" ON "public"."profiles" USING ((("id" = "auth"."uid"()) AND "internal"."is_active_member"()));

ALTER POLICY "reservations_delete" ON "public"."reservations" USING (((("user_id" = "auth"."uid"()) AND "internal"."is_active_member"()) OR "internal"."is_admin"()));
ALTER POLICY "reservations_insert" ON "public"."reservations" WITH CHECK (((("user_id" = "auth"."uid"()) AND "internal"."is_active_member"()) OR "internal"."is_admin"()));
ALTER POLICY "reservations_select" ON "public"."reservations" USING (((("user_id" = "auth"."uid"()) AND "internal"."is_active_member"()) OR "internal"."is_admin"()));
ALTER POLICY "reservations_update" ON "public"."reservations" USING (((("user_id" = "auth"."uid"()) AND "internal"."is_active_member"()) OR "internal"."is_admin"())) WITH CHECK (((("user_id" = "auth"."uid"()) AND "internal"."is_active_member"()) OR "internal"."is_admin"()));

ALTER POLICY "rooms_admin_delete" ON "public"."rooms" USING ("internal"."is_admin"());
ALTER POLICY "rooms_admin_insert" ON "public"."rooms" WITH CHECK ("internal"."is_admin"());
ALTER POLICY "rooms_admin_update" ON "public"."rooms" USING ("internal"."is_admin"()) WITH CHECK ("internal"."is_admin"());

ALTER POLICY "tables_admin_delete" ON "public"."tables" USING ("internal"."is_admin"());
ALTER POLICY "tables_admin_insert" ON "public"."tables" WITH CHECK ("internal"."is_admin"());
ALTER POLICY "tables_admin_update" ON "public"."tables" USING ("internal"."is_admin"()) WITH CHECK ("internal"."is_admin"());

-- Drop public schema functions (no longer needed)
DROP FUNCTION IF EXISTS "public"."is_active_member"();
DROP FUNCTION IF EXISTS "public"."is_admin"();
