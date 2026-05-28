-- KIM-391: Force revoke handle_new_user with DO block to handle idempotency
-- Uses DO block to safely revoke even if already revoked

DO $$
BEGIN
  -- Revoke from anon (may already be revoked, errors ignored)
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "anon";
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Already revoked or function doesn't exist
  END;

  -- Revoke from authenticated
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "authenticated";
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Revoke from public
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "public";
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Grant only to service_role (admin operations)
  BEGIN
    GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Already granted
  END;
END $$;
