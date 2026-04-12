-- Migration: add no-show tracking columns to profiles
-- Required by M7A (KIM-335): admin controls to view and reset no-show counts.
-- These columns are populated by the no-show tracking cron (KIM-329).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS no_show_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked_until timestamptz;
