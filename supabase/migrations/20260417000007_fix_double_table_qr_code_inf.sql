UPDATE "public"."tables"
SET "qr_code_inf" = NULL
WHERE "type" != 'removable_top'
  AND "qr_code_inf" IS NOT NULL;
