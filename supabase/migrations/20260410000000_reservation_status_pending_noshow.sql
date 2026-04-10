-- Migration: extend reservation_status enum, add activated_at, add qr_code_inf

-- Add new enum values (IF NOT EXISTS is safe and idempotent)
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'no_show';

-- Change default status for new reservations from 'active' to 'pending'
ALTER TABLE public.reservations ALTER COLUMN status SET DEFAULT 'pending';

-- Add activated_at to track when a reservation was activated via QR check-in
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS activated_at timestamptz;

-- Add qr_code_inf for the lower side of removable_top (double) tables
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS qr_code_inf text;
