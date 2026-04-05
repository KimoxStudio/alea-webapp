-- Issue #39: email removed from application profile model.
-- Column retained for future re-introduction without a breaking migration.
ALTER TABLE profiles
  ALTER COLUMN email DROP NOT NULL;

COMMENT ON COLUMN profiles.email IS 'Reserved for future use. Not currently read by the application. Supabase Auth manages the canonical email in auth.users.';
