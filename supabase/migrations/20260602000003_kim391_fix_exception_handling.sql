-- KIM-391: Replace broad WHEN OTHERS exception handling with specific UNDEFINED_FUNCTION
-- Previous migrations (20260527160001, 20260528000008) used WHEN OTHERS THEN NULL which
-- silently swallows all errors including real permission/schema errors.
-- This migration is idempotent: if cancel_expired_pending_reservations does not exist
-- (SQLSTATE 42883 = UNDEFINED_FUNCTION), the exception is caught and execution continues.
-- Real errors (INSUFFICIENT_PRIVILEGE, etc.) now propagate correctly.
DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"() FROM "anon";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL;
  END;
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"() FROM "authenticated";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL;
  END;
END $$;
