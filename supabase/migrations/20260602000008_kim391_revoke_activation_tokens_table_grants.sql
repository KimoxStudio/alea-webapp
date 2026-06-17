-- KIM-391: Revoke table-level grants on activation_tokens
-- Baseline migration granted ALL to anon/authenticated at the table level.
-- With RLS policies being dropped/restricted, revoke table-level access entirely.
-- Only admin/service_role should access this table.

DROP POLICY IF EXISTS "activation_tokens_authenticated_select_own" ON "public"."activation_tokens";
REVOKE ALL ON TABLE "public"."activation_tokens" FROM "anon";
REVOKE ALL ON TABLE "public"."activation_tokens" FROM "authenticated";
