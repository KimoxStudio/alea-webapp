-- KIM-391: Remove authenticated UPDATE policy from activation_tokens
-- Activation tokens are server-controlled state via admin client only.
-- The authenticated UPDATE policy is unnecessary and allows users to mutate
-- token_hash/expires_at/used_at directly via PostgREST, which is a security risk.
DROP POLICY IF EXISTS "activation_tokens_authenticated_update_own" ON "public"."activation_tokens";
