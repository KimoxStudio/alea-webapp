-- KIM-391: Revoke EXECUTE on handle_new_user from public role (complement to 20260528000003)
-- Supabase linter requires revoking from both anon AND public for unauthenticated coverage

DO $$
BEGIN
  BEGIN
    REVOKE EXECUTE ON FUNCTION "public"."handle_new_user"() FROM "public";
  EXCEPTION WHEN UNDEFINED_FUNCTION THEN
    NULL;
  END;
END $$;
