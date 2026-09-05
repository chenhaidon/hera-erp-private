CREATE TABLE IF NOT EXISTS wechat_jsapi_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id text NOT NULL,
  app_secret text NOT NULL,
  access_token text,
  token_expires_at timestamptz,
  jsapi_ticket text,
  ticket_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE wechat_jsapi_config IS '微信公众号 JS-SDK 配置';
COMMENT ON COLUMN wechat_jsapi_config.app_id IS '微信公众号 AppID';
COMMENT ON COLUMN wechat_jsapi_config.app_secret IS '微信公众号 AppSecret';
COMMENT ON COLUMN wechat_jsapi_config.access_token IS '微信接口调用凭据';
COMMENT ON COLUMN wechat_jsapi_config.jsapi_ticket IS 'JS-SDK 调用票据';