-- Migration: add no-show tracking columns to profiles
-- no_show_count: incremented each time a user's reservation is marked as no_show
-- blocked_until: when set, the user cannot make new reservations until this timestamp passes

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS no_show_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_until timestamptz;
