-- KIM-391: Force revoke EXECUTE on handle_new_user from anon and authenticated roles
-- This resolves the anon_security_definer_function_executable and authenticated_security_definer_function_executable warnings

-- Revoke EXECUTE from anon role
REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "anon";

-- Revoke EXECUTE from authenticated role
REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "authenticated";

-- Grant EXECUTE only to service_role (admin operations only)
GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";
