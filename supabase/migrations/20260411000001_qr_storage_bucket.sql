-- Create a public storage bucket for table QR code images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'table-qr-codes',
  'table-qr-codes',
  true,
  52428,  -- 50 KB max per file
  ARRAY['image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to QR images
CREATE POLICY IF NOT EXISTS "qr_codes_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'table-qr-codes');

-- Allow service role to upload/update/delete QR images
CREATE POLICY IF NOT EXISTS "qr_codes_service_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'table-qr-codes');

CREATE POLICY IF NOT EXISTS "qr_codes_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'table-qr-codes');

CREATE POLICY IF NOT EXISTS "qr_codes_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'table-qr-codes');
