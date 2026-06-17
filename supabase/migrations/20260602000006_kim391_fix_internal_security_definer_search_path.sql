-- KIM-391: Fix search_path on internal SECURITY DEFINER functions
-- Both is_admin() and is_active_member() must use SET search_path = ''
-- to prevent shadow object attacks in the internal schema.

CREATE OR REPLACE FUNCTION "internal"."is_admin"()
  RETURNS BOOLEAN
  LANGUAGE SQL
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE "id" = "auth"."uid"()
      AND "role" = 'admin'::"public"."role"
  )
$$;

CREATE OR REPLACE FUNCTION "internal"."is_active_member"()
  RETURNS BOOLEAN
  LANGUAGE SQL
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "public"."profiles"
    WHERE "id" = "auth"."uid"()
      AND "is_active" = true
  )
$$;
