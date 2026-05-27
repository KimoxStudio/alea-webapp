-- KIM-392: Force-fix SECURITY DEFINER function permissions
-- Ensures correct state regardless of prior migration issues

-- Functions that should NOT be callable by anon/authenticated (action functions)
-- Only revoke if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cancel_expired_pending_reservations' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE ALL ON FUNCTION "public"."cancel_expired_pending_reservations"(integer, timestamp with time zone, text) FROM "anon" CASCADE;
    REVOKE ALL ON FUNCTION "public"."cancel_expired_pending_reservations"(integer, timestamp with time zone, text) FROM "authenticated" CASCADE;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user' AND pronamespace = 'public'::regnamespace) THEN
    REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "anon" CASCADE;
    REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "authenticated" CASCADE;
  END IF;
END
$$;

-- Functions that MUST be callable by anon/authenticated (RLS helpers)
-- Grant if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "anon";
    GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "authenticated";
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_active_member' AND pronamespace = 'public'::regnamespace) THEN
    GRANT EXECUTE ON FUNCTION "public"."is_active_member"() TO "anon";
    GRANT EXECUTE ON FUNCTION "public"."is_active_member"() TO "authenticated";
  END IF;
END
$$;
