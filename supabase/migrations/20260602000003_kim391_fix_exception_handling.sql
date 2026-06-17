-- KIM-391: Keep cancel_expired_pending_reservations revoke idempotent
-- Revoke migrations now catch only UNDEFINED_FUNCTION to avoid hiding
-- real permission/schema errors.
-- This migration is idempotent: if cancel_expired_pending_reservations does not exist
-- (SQLSTATE 42883 = UNDEFINED_FUNCTION), the exception is caught and execution continues.
-- Real errors (INSUFFICIENT_PRIVILEGE, etc.) now propagate correctly.
DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "anon";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL;
  END;
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "authenticated";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL;
  END;
END $$;
