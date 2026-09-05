INSERT INTO public.site_settings (key, value)
VALUES
  ('wechat_miniapp_appid', ''),
  ('wechat_miniapp_secret', '')
ON CONFLICT (key) DO NOTHING;
