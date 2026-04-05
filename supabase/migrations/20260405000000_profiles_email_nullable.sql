-- Issue #39: email removed from application profile model.
-- Column retained for future re-introduction without a breaking migration.
ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN public.profiles.email IS 'Reserved for future use in the profile model. Read only for auth credential resolution during login; never returned in public user or profile responses. Supabase Auth manages the canonical email in auth.users.';
