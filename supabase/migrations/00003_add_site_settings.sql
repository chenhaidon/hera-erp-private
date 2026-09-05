CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- 所有角色可读取站点设置
CREATE POLICY "site_settings_select_all"
  ON public.site_settings FOR SELECT
  USING (true);

-- 匿名用户可读取站点设置
CREATE POLICY "site_settings_select_anon"
  ON public.site_settings FOR SELECT
  TO anon
  USING (true);

-- 仅管理员可更新站点设置
CREATE POLICY "site_settings_update_admin"
  ON public.site_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 仅管理员可插入站点设置
CREATE POLICY "site_settings_insert_admin"
  ON public.site_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 仅管理员可删除站点设置
CREATE POLICY "site_settings_delete_admin"
  ON public.site_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 初始化默认站点配置
INSERT INTO public.site_settings (key, value) VALUES
  ('site_name', '浦江家纺智造管理平台'),
  ('site_logo_url', ''),
  ('site_short_name', '家纺智造')
ON CONFLICT (key) DO NOTHING;