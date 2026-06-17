-- KIM-391: Grant internal schema access for RLS policy evaluation
-- The internal.is_admin() and internal.is_active_member() SECURITY DEFINER functions
-- are called by RLS policies but were never granted to authenticated.
-- Without GRANT, all RLS policies invoking these functions fail with permission denied.

GRANT USAGE ON SCHEMA "internal" TO "authenticated";
GRANT EXECUTE ON FUNCTION "internal"."is_admin"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "internal"."is_active_member"() TO "authenticated";
