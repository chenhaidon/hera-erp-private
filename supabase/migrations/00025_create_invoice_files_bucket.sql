INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'invoice-files',
  'invoice-files',
  true,
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "invoice_files_auth_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'invoice-files')
  WITH CHECK (bucket_id = 'invoice-files');

CREATE POLICY "invoice_files_anon_select"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'invoice-files');