INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ecommerce-images',
  'ecommerce-images',
  true,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Allow all ecommerce-images'
  ) THEN
    CREATE POLICY "Allow all ecommerce-images"
    ON storage.objects FOR ALL
    TO public
    USING (bucket_id = 'ecommerce-images')
    WITH CHECK (bucket_id = 'ecommerce-images');
  END IF;
END
$$;