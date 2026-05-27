-- Move btree_gist extension from public schema to postgres schema.
-- KIM-391: Fix remaining Supabase security linter warnings.
-- Extensions should be installed in the postgres schema, not public.

DROP EXTENSION IF EXISTS "btree_gist" CASCADE;
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "postgres";
