-- Migration: extend reservation_status enum with pending and no_show values
-- NOTE: These ADD VALUE statements must be in a separate transaction from any DDL
-- that uses these new values (PostgreSQL restriction SQLSTATE 55P04).

ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'no_show';
