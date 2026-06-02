-- KIM-391: Revoke table-level grants on activation_tokens
-- Baseline migration granted ALL to anon/authenticated at the table level.
-- With RLS policies being dropped/restricted, revoke table-level access entirely.
-- Only admin/service_role should access this table.

REVOKE ALL ON TABLE "public"."activation_tokens" FROM "anon";
REVOKE INSERT, UPDATE, DELETE ON TABLE "public"."activation_tokens" FROM "authenticated";
