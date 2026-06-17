-- KIM-391: Force revoke handle_new_user with narrow missing-function handling
-- REVOKE/GRANT are idempotent; only a missing function is ignored.

DO $$
BEGIN
  -- Revoke from anon
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "anon";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;

  -- Revoke from authenticated
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "authenticated";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;

  -- Revoke from public
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "public";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;

  -- Grant only to service_role (admin operations)
  BEGIN
    GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;
END $$;
