-- Fix mutable search_path warnings (Supabase linter: function_search_path_mutable)
-- All functions use fully-qualified references so empty search_path is safe.

CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION "public"."is_active_member"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
$$;

-- Fix public_bucket_allows_listing: drop broad SELECT policy on table-qr-codes.
-- Public buckets serve objects by URL without a policy; this policy only enabled
-- unauthenticated listing of all keys in the bucket.
DROP POLICY IF EXISTS "qr_codes_public_read" ON "storage"."objects";

-- Revoke EXECUTE on SECURITY DEFINER cron functions from anon and authenticated.
-- These functions are invoked exclusively by pg_cron / service_role and must not
-- be callable by client roles.
REVOKE ALL ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."create_event_atomic"("p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "anon";
REVOKE ALL ON FUNCTION "public"."create_event_atomic"("p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."mark_no_show_reservations"("reference_time" timestamp with time zone, "club_timezone" "text") FROM "anon";
REVOKE ALL ON FUNCTION "public"."mark_no_show_reservations"("reference_time" timestamp with time zone, "club_timezone" "text") FROM "authenticated";

REVOKE ALL ON FUNCTION "public"."update_event_atomic"("p_id" "uuid", "p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "anon";
REVOKE ALL ON FUNCTION "public"."update_event_atomic"("p_id" "uuid", "p_title" "text", "p_description" "text", "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_room_id" "uuid", "p_all_day" boolean) FROM "authenticated";

-- Revoke EXECUTE on get_database_time from anon and authenticated.
-- This function is used internally and must not be callable by client roles.
REVOKE ALL ON FUNCTION "public"."get_database_time"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."get_database_time"() FROM "authenticated";
