-- KIM-394: Force revoke EXECUTE on action functions from anon/authenticated
-- cancel_expired_pending_reservations and handle_new_user must not be callable via /rpc/

DO $$
BEGIN
  -- Revoke cancel_expired_pending_reservations (may not exist if dropped)
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "anon";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL; END;

  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."cancel_expired_pending_reservations"("grace_minutes" integer, "reference_time" timestamp with time zone, "club_timezone" "text") FROM "authenticated";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL; END;

  -- Revoke handle_new_user
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "anon";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL; END;

  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "authenticated";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN NULL; END;
END $$;
