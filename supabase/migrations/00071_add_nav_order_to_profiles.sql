ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nav_order jsonb;
COMMENT ON COLUMN public.profiles.nav_order IS '用户自定义左侧导航排序，存储导航路径数组';