-- Foundation for member import and pre-registered accounts.
-- Adds contact/profile fields required by KIM-377 and separates auth email
-- from member-facing contact email so imported users can exist before activation.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auth_email text,
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS active_from timestamptz,
  ADD COLUMN IF NOT EXISTS psw_changed timestamptz,
  ADD COLUMN IF NOT EXISTS phone text;

UPDATE public.profiles
SET auth_email = normalized.next_auth_email
FROM (
  SELECT
    ranked.id,
    CASE
      WHEN ranked.duplicate_rank = 1 THEN ranked.base_auth_email
      ELSE regexp_replace(
        ranked.base_auth_email,
        '@',
        '+legacy' || ranked.duplicate_rank::text || '@'
      )
    END AS next_auth_email
  FROM (
    SELECT
      profiles.id,
      COALESCE(
        NULLIF(LOWER(BTRIM(auth_users.email)), ''),
        NULLIF(LOWER(BTRIM(profiles.auth_email)), ''),
        NULLIF(LOWER(BTRIM(profiles.email)), ''),
        'legacy-' || REPLACE(profiles.id::text, '-', '') || '@members.alea.internal'
      ) AS base_auth_email,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(
          NULLIF(LOWER(BTRIM(auth_users.email)), ''),
          NULLIF(LOWER(BTRIM(profiles.auth_email)), ''),
          NULLIF(LOWER(BTRIM(profiles.email)), ''),
          'legacy-' || REPLACE(profiles.id::text, '-', '') || '@members.alea.internal'
        )
        ORDER BY profiles.id
      ) AS duplicate_rank
    FROM public.profiles AS profiles
    LEFT JOIN auth.users AS auth_users
      ON auth_users.id = profiles.id
  ) AS ranked
) AS normalized
WHERE public.profiles.id = normalized.id
  AND (
    public.profiles.auth_email IS NULL
    OR BTRIM(public.profiles.auth_email) = ''
    OR public.profiles.auth_email <> normalized.next_auth_email
  );

ALTER TABLE public.profiles
  ALTER COLUMN auth_email SET NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.profiles
  ALTER COLUMN is_active SET DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_email_key ON public.profiles (auth_email);

COMMENT ON COLUMN public.profiles.auth_email IS 'Supabase Auth credential email used for sign-in and account activation.';
COMMENT ON COLUMN public.profiles.email IS 'Optional contact email imported from the member registry.';
COMMENT ON COLUMN public.profiles.full_name IS 'Canonical member full name imported from the registry.';
COMMENT ON COLUMN public.profiles.active_from IS 'Timestamp when the member completed account activation.';
COMMENT ON COLUMN public.profiles.psw_changed IS 'Timestamp of the latest password change.';
COMMENT ON COLUMN public.profiles.phone IS 'Optional contact phone imported from the member registry.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, auth_email, member_number, role)
  VALUES (
    NEW.id,
    NULL,
    NEW.email,
    'M-' || UPPER(RIGHT(REPLACE(NEW.id::text, '-', ''), 12)),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
