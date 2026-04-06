-- Replace text status column with boolean is_active
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS status;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.is_active IS 'true = active, false = suspended — managed by admin';
