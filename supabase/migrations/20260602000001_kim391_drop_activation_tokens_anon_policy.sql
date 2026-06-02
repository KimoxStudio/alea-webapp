-- KIM-391: Remove anon SELECT policy from activation_tokens
-- The activation_tokens_anon_select_by_hash policy was created to allow anon validation,
-- but token validation is handled server-side via the admin client (bypasses RLS).
-- Direct anon access to this table is not needed and exposes sensitive token data.
DROP POLICY IF EXISTS "activation_tokens_anon_select_by_hash" ON "public"."activation_tokens";
