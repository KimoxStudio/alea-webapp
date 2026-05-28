-- KIM-391: Safe revoke for dropped cancel_expired_pending_reservations function
-- Migration 20260527160001 tried to revoke a function that was dropped in KIM-366
-- This migration safely handles the error by attempting revoke in a DO block

DO $$
BEGIN
  -- Try to revoke from anon (function may not exist)
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"() FROM "anon";
  EXCEPTION WHEN OTHERS THEN
    -- Function doesn't exist or already revoked — continue
    NULL;
  END;

  -- Try to revoke from authenticated
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"() FROM "authenticated";
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;
