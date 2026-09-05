CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'refresh-wechat-jsapi-ticket',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/wechat-refresh-jsapi-ticket',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'publishable_key')
      ),
      body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $$
);