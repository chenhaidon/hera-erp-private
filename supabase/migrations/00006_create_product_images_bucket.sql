-- 创建产品图片存储桶
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  false,
  1048576,
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 存储对象 RLS 策略：允许所有已认证用户读写
CREATE POLICY "product_images_auth_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'product-images')
  WITH CHECK (bucket_id = 'product-images');

-- 公开读取策略
CREATE POLICY "product_images_anon_select"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'product-images');