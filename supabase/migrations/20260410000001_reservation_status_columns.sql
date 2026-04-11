-- Migration: set pending as default reservation status, add activated_at and qr_code_inf
-- Must run in a separate transaction from the ADD VALUE statements above.

-- Change default status for new reservations from 'active' to 'pending'
ALTER TABLE public.reservations ALTER COLUMN status SET DEFAULT 'pending';

-- Add activated_at to track when a reservation was activated via QR check-in
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS activated_at timestamptz;

-- Add qr_code_inf for the lower side of removable_top (double) tables
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS qr_code_inf text;
