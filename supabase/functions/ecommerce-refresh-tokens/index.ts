import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

interface PlatformAuth {
  id: string;
  platform_code: 'taobao' | 'pinduoduo' | 'douyin';
  platform_name: string;
  shop_name: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, Content-Type, Authorization',
};

function createSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key);
}

async function refreshPlatformToken(auth: PlatformAuth): Promise<{
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  reason?: string;
}> {
  if (!auth.refresh_token || auth.refresh_token.startsWith('mock_')) {
    return { success: false, reason: '未配置真实 Refresh Token' };
  }
  // 平台 Token 刷新适配器占位
  return { success: false, reason: '平台 Token 刷新适配器占位' };
}

async function createAlert(
  supabase: ReturnType<typeof createClient>,
  payload: {
    auth_id?: string;
    platform_code?: string;
    shop_name?: string;
    alert_type: 'sync_failed' | 'token_expired' | 'rate_limited' | 'token_refresh_failed';
    alert_reason?: string;
  }
) {
  await supabase.from('ecommerce_alert_log').insert({
    ...payload,
    alert_status: 'pending',
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const supabase = createSupabaseClient();
    const threshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('ecommerce_platform_auth')
      .select('*')
      .eq('auth_status', 'authorized')
      .lte('token_expires_at', threshold);

    if (error) throw error;
    const auths = (data || []) as PlatformAuth[];
    const results = [];

    for (const auth of auths) {
      const refresh = await refreshPlatformToken(auth);
      if (refresh.success) {
        await supabase
          .from('ecommerce_platform_auth')
          .update({
            access_token: refresh.access_token,
            refresh_token: refresh.refresh_token,
            token_expires_at: refresh.expires_at,
            updated_at: new Date().toISOString(),
          })
          .eq('id', auth.id);
        results.push({
          platform: auth.platform_name,
          shop: auth.shop_name,
          success: true,
        });
      } else {
        await supabase
          .from('ecommerce_platform_auth')
          .update({
            auth_status: 'expired',
            updated_at: new Date().toISOString(),
          })
          .eq('id', auth.id);
        await createAlert(supabase, {
          auth_id: auth.id,
          platform_code: auth.platform_code,
          shop_name: auth.shop_name,
          alert_type: 'token_refresh_failed',
          alert_reason: refresh.reason,
        });
        results.push({
          platform: auth.platform_name,
          shop: auth.shop_name,
          success: false,
          reason: refresh.reason,
        });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
