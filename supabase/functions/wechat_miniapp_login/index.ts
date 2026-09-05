import { createClient } from 'jsr:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { code } = await req.json().catch(() => ({}));
    if (!code) {
      return new Response(JSON.stringify({ message: '缺少code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    let APP_ID = Deno.env.get('WECHAT_MINIPROGRAM_LOGIN_APP_ID') || '';
    let APP_SECRET = Deno.env.get('WECHAT_MINIPROGRAM_LOGIN_APP_SECRET') || '';

    if (!APP_ID || !APP_SECRET) {
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('site_settings')
        .select('key, value')
        .in('key', ['wechat_miniapp_appid', 'wechat_miniapp_secret']);

      if (settingsError) {
        return new Response(JSON.stringify({ message: `读取小程序配置失败: ${settingsError.message}` }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const map: Record<string, string> = {};
      settings?.forEach((item) => {
        if (item.value) map[item.key] = item.value;
      });

      APP_ID = map['wechat_miniapp_appid'] || '';
      APP_SECRET = map['wechat_miniapp_secret'] || '';
    }

    if (!APP_ID || !APP_SECRET) {
      return new Response(JSON.stringify({ message: '未配置微信小程序登录密钥' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const wxRes = await fetch(
      `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`,
    );
    const wxData = await wxRes.json();

    if (wxData.errcode) {
      return new Response(JSON.stringify({ message: `微信接口错误: ${wxData.errmsg}` }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { openid } = wxData;
    const email = `${openid}@wechat.login`;

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { from: 'wechat', openid },
    });
    if (createError && !createError.message.includes('already been registered')) {
      return new Response(JSON.stringify({ message: createError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { data: { from: 'wechat', openid } },
    });

    if (magicLinkError) {
      return new Response(JSON.stringify({ message: magicLinkError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const hashedToken = magicLinkData?.properties?.hashed_token ?? '';
    const verificationType = magicLinkData?.properties?.verification_type ?? 'email';

    if (!hashedToken) {
      return new Response(JSON.stringify({ message: '无法生成token' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(
      JSON.stringify({ token: hashedToken, verification_type: verificationType, openid }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
