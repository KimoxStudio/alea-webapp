-- KIM-391: Safe revoke for dropped cancel_expired_pending_reservations function
-- Migration 20260527160001 tried to revoke a function that was dropped in KIM-366
-- This migration ignores only the expected missing-function error.

DO $$
BEGIN
  -- Try to revoke from anon (function may not exist)
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "anon";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;

  -- Try to revoke from authenticated
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "authenticated";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;
END $$;
