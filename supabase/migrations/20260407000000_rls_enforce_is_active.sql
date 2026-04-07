-- ============================================================
-- Migration: 20260407000000_rls_enforce_is_active.sql
--
-- Enforce is_active on member-facing RLS policies so that
-- suspended users (is_active = false) cannot read or write
-- reservations or their own profile, even with a valid JWT.
--
-- Admin policies are intentionally unchanged — admins retain
-- full access regardless of their own is_active status.
-- ============================================================

-- Helper: is the current user an active (non-suspended) member?
-- SECURITY DEFINER + fixed search_path prevents RLS recursion
-- when this function reads public.profiles.
CREATE OR REPLACE FUNCTION public.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
  )
$$;

-- ---- reservations ----

DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
CREATE POLICY "reservations_select"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_active_member())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "reservations_insert" ON public.reservations;
CREATE POLICY "reservations_insert"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND public.is_active_member())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_active_member())
    OR public.is_admin()
  )
  WITH CHECK (
    (user_id = auth.uid() AND public.is_active_member())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "reservations_delete" ON public.reservations;
CREATE POLICY "reservations_delete"
  ON public.reservations FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_active_member())
    OR public.is_admin()
  );

-- ---- profiles (member-facing policies only) ----

DROP POLICY IF EXISTS "profiles_member_select" ON public.profiles;
CREATE POLICY "profiles_member_select"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() AND public.is_active_member());

DROP POLICY IF EXISTS "profiles_member_update" ON public.profiles;
CREATE POLICY "profiles_member_update"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() AND public.is_active_member())
  WITH CHECK (id = auth.uid() AND role = 'member'::public.role AND public.is_active_member());
