-- ============================================================
-- Alea Webapp — Event room blocks all-day support
-- Migration: 20260413000002_event_room_blocks_all_day.sql
-- KIM-376
-- ============================================================
-- Project rule: keep exactly one SQL statement per migration file.

ALTER TABLE public.event_room_blocks
  ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;
