-- Restrict direct member updates on profiles now that auth and activation
-- metadata live on the same row. All profile mutations must flow through
-- trusted server-side admin/service paths.

DROP POLICY IF EXISTS "profiles_member_update" ON public.profiles;
