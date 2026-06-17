-- Grant EXECUTE on RLS helper functions back to anon role.
-- KIM-391 fix: is_active_member() and is_admin() must be callable by anon for RLS policies to work.

GRANT EXECUTE ON FUNCTION "public"."is_active_member"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO "anon";
