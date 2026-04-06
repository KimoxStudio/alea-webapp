-- ============================================================
-- Add FK from reservations.user_id to public.profiles(id)
-- This allows PostgREST to infer the reservations → profiles
-- relationship and resolve profiles(member_number) joins.
--
-- profiles.id mirrors auth.users.id (1:1), so this FK is safe
-- to add without data migration.
-- ============================================================

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_user_id_fkey_profiles
  FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE;
