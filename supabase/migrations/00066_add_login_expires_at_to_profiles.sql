ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS login_expires_at timestamptz;

COMMENT ON COLUMN public.profiles.login_expires_at IS '登录会话过期时间，超过后需重新登录';