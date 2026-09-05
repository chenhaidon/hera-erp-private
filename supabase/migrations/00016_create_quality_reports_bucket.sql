BEGIN;

INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('quality-reports', 'quality-reports', true, false, 1048576, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'];

CREATE POLICY "Allow public read quality-reports"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'quality-reports');

CREATE POLICY "Allow authenticated upload quality-reports"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'quality-reports');

CREATE POLICY "Allow authenticated update quality-reports"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'quality-reports');

CREATE POLICY "Allow authenticated delete quality-reports"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'quality-reports');

COMMIT;