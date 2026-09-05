DROP TABLE IF EXISTS wechat_jsapi_config;

SELECT cron.unschedule('refresh-wechat-jsapi-ticket');