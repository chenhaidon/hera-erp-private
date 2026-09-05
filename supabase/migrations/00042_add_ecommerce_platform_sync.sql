-- 启用扩展
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 为采购发货跟踪单增加平台订单号与状态字段
ALTER TABLE ecommerce_purchase_tracking
ADD COLUMN IF NOT EXISTS platform_order_no text,
ADD COLUMN IF NOT EXISTS platform_code text,
ADD COLUMN IF NOT EXISTS platform_name text,
ADD COLUMN IF NOT EXISTS order_status text,
ADD COLUMN IF NOT EXISTS buyer_nickname text;

CREATE INDEX IF NOT EXISTS idx_ecommerce_purchase_tracking_platform_order_no
ON ecommerce_purchase_tracking(platform_order_no);

-- 平台授权表
CREATE TABLE IF NOT EXISTS ecommerce_platform_auth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_code text NOT NULL,
  platform_name text NOT NULL,
  shop_name text NOT NULL,
  app_key text,
  app_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  auth_status text NOT NULL DEFAULT 'unauthorized',
  authorized_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_synced_at timestamptz,
  total_synced_orders int DEFAULT 0
);

COMMENT ON TABLE ecommerce_platform_auth IS '电商平台店铺授权信息';

-- 拉单日志表
CREATE TABLE IF NOT EXISTS ecommerce_order_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES ecommerce_platform_auth(id) ON DELETE SET NULL,
  platform_code text,
  platform_name text,
  shop_name text,
  sync_status text NOT NULL DEFAULT 'success',
  synced_orders int DEFAULT 0,
  new_orders int DEFAULT 0,
  updated_orders int DEFAULT 0,
  failed_reason text,
  execution_time_ms int,
  request_params jsonb,
  response_data jsonb,
  created_at timestamptz DEFAULT now()
);

-- API 调用限流表
CREATE TABLE IF NOT EXISTS ecommerce_api_rate_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES ecommerce_platform_auth(id) ON DELETE CASCADE,
  platform_code text NOT NULL,
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  call_count int NOT NULL DEFAULT 0,
  daily_limit int NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (auth_id, call_date)
);

-- 告警日志表
CREATE TABLE IF NOT EXISTS ecommerce_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id uuid REFERENCES ecommerce_platform_auth(id) ON DELETE SET NULL,
  platform_code text,
  shop_name text,
  alert_type text NOT NULL,
  alert_reason text,
  alert_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- 触发更新时间戳
CREATE OR REPLACE FUNCTION update_ecommerce_platform_auth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ecommerce_platform_auth_updated_at ON ecommerce_platform_auth;
CREATE TRIGGER trg_ecommerce_platform_auth_updated_at
BEFORE UPDATE ON ecommerce_platform_auth
FOR EACH ROW
EXECUTE FUNCTION update_ecommerce_platform_auth_updated_at();

-- RLS 策略
ALTER TABLE ecommerce_platform_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_order_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_api_rate_limit ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecommerce_alert_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all ecommerce_platform_auth" ON ecommerce_platform_auth;
CREATE POLICY "Allow all ecommerce_platform_auth" ON ecommerce_platform_auth
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all ecommerce_order_sync_log" ON ecommerce_order_sync_log;
CREATE POLICY "Allow all ecommerce_order_sync_log" ON ecommerce_order_sync_log
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all ecommerce_api_rate_limit" ON ecommerce_api_rate_limit;
CREATE POLICY "Allow all ecommerce_api_rate_limit" ON ecommerce_api_rate_limit
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all ecommerce_alert_log" ON ecommerce_alert_log;
CREATE POLICY "Allow all ecommerce_alert_log" ON ecommerce_alert_log
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- 每15分钟调用一次电商订单同步 Edge Function
SELECT cron.schedule(
  'ecommerce-sync-orders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/ecommerce-sync-orders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);

-- 每小时调用一次 Token 刷新 Edge Function
SELECT cron.schedule(
  'ecommerce-refresh-tokens',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/ecommerce-refresh-tokens',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'publishable_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);
