ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'suspended'));

COMMENT ON COLUMN public.profiles.status IS 'active | suspended — managed by admin';
