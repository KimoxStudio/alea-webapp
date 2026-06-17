-- KIM-391: Force revoke EXECUTE on handle_new_user from anon and authenticated roles
-- This resolves the anon_security_definer_function_executable and authenticated_security_definer_function_executable warnings

DO $$
BEGIN
  -- Revoke EXECUTE from anon role
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "anon";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;

  -- Revoke EXECUTE from authenticated role
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "authenticated";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;

  -- Grant EXECUTE only to service_role (admin operations only)
  BEGIN
    GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;
END $$;
