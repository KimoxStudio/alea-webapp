-- Migration: fix handle_new_user member_number generation
--
-- The previous implementation used LEFT(REPLACE(uuid, '-', ''), 8) which takes
-- the first 8 hex characters of the UUID. Seed users share the prefix
-- '10000000-0000-0000-0000-...' so all five generated the same placeholder
-- 'M-10000000', causing a unique constraint violation on the second insert.
--
-- Fix: use the last 12 hex characters of the UUID (the final UUID segment,
-- stripped of the trailing hyphen). This portion varies across all seed users
-- and is sufficiently unique for real UUIDv4 values.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, member_number, role)
  VALUES (
    NEW.id,
    NEW.email,
    -- Use the last 12 hex chars of the UUID as the temporary placeholder.
    -- Format: 'M-XXXXXXXXXXXX' (14 chars, fits within varchar(20)).
    -- An admin can assign a proper member number after account creation.
    'M-' || UPPER(RIGHT(REPLACE(NEW.id::text, '-', ''), 12)),
    'member'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;
