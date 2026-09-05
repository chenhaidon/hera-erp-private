import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';

interface PlatformAuth {
  id: string;
  platform_code: 'taobao' | 'pinduoduo' | 'douyin';
  platform_name: string;
  shop_name: string;
  app_key?: string;
  app_secret?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
}

interface SyncOrder {
  platform_order_no: string;
  buyer_nickname: string;
  product_name: string;
  product_specification: string;
  order_quantity: number;
  paid_amount: number;
  order_status: string;
  created_at: string;
}

interface OrderResult {
  orders: SyncOrder[];
  raw?: any;
}

const DAILY_LIMITS: Record<string, number> = {
  taobao: 10000,
  pinduoduo: 5000,
  douyin: 8000,
};

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

async function getActiveAuths(supabase: ReturnType<typeof createClient>): Promise<PlatformAuth[]> {
  const { data, error } = await supabase
    .from('ecommerce_platform_auth')
    .select('*')
    .eq('auth_status', 'authorized');
  if (error) throw error;
  return data || [];
}

async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  auth: PlatformAuth,
  cost = 1
): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('ecommerce_api_rate_limit')
    .select('*')
    .eq('auth_id', auth.id)
    .eq('call_date', today)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  const limit = DAILY_LIMITS[auth.platform_code] || 0;
  const current = data?.call_count || 0;
  if (current + cost > limit) {
    return { allowed: false, remaining: Math.max(0, limit - current) };
  }

  if (data) {
    await supabase
      .from('ecommerce_api_rate_limit')
      .update({ call_count: current + cost, updated_at: new Date().toISOString() })
      .eq('id', data.id);
  } else {
    await supabase.from('ecommerce_api_rate_limit').insert({
      auth_id: auth.id,
      platform_code: auth.platform_code,
      call_date: today,
      call_count: cost,
      daily_limit: limit,
    });
  }

  return { allowed: true, remaining: limit - current - cost };
}

async function logSync(
  supabase: ReturnType<typeof createClient>,
  payload: {
    auth_id?: string;
    platform_code?: string;
    platform_name?: string;
    shop_name?: string;
    sync_status: 'success' | 'failed';
    synced_orders?: number;
    new_orders?: number;
    updated_orders?: number;
    failed_reason?: string;
    execution_time_ms?: number;
    request_params?: any;
    response_data?: any;
  }
) {
  await supabase.from('ecommerce_order_sync_log').insert(payload);
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

async function fetchOrdersFromPlatform(auth: PlatformAuth): Promise<OrderResult> {
  // 实际接入时，根据平台调用官方 API。当前无真实 token 时返回空数据并提示。
  if (!auth.access_token || auth.access_token.startsWith('mock_')) {
    return {
      orders: [],
      raw: { error: '未配置真实 Access Token，跳过拉取' },
    };
  }

  // 平台适配器：接入真实 API 时在此扩展
  switch (auth.platform_code) {
    case 'taobao': {
      // 淘宝：调用 taobao.trade.fullinfo.get 等
      return { orders: [], raw: { message: '淘宝适配器占位' } };
    }
    case 'pinduoduo': {
      return await fetchPinduoduoOrders(auth);
    }
    case 'douyin': {
      // 抖店：调用抖店开放平台订单查询接口
      return { orders: [], raw: { message: '抖店适配器占位' } };
    }
    default:
      return { orders: [], raw: { error: '不支持的平台' } };
  }
}

// ============ 拼多多开放平台适配器 ============

const PDD_GATEWAY = 'https://gw-api.pinduoduo.com/api/router';

// 拼多多订单状态映射到统一状态
const PDD_STATUS_MAP: Record<number, string> = {
  1: '待发货',
  2: '已发货',
  3: '已完成',
  4: '已取消',
};

// 拼多多订单查询参数
interface PddOrderQuery {
  type: string;
  order_status: number;
  start_confirm_at: number;
  end_confirm_at: number;
  page: number;
  page_size: number;
}

// MD5 实现（Deno 兼容），用于生成拼多多接口签名
async function md5(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 生成拼多多接口签名
async function buildPddSign(
  params: Record<string, string>,
  clientSecret: string
): Promise<string> {
  const keys = Object.keys(params).sort();
  const sortedStr = keys.map((k) => `${k}${params[k]}`).join('');
  return await md5(`${clientSecret}${sortedStr}${clientSecret}`).toUpperCase();
}

// 将拼多多订单数据映射为统一结构
function mapPddOrder(raw: any): SyncOrder {
  const orderSn = String(raw.order_sn || '');
  const item = (raw.order_list || [])[0] || raw;
  const goodsList = raw.goods_list || [];
  const firstGoods = goodsList[0] || {};
  const totalQty = goodsList.reduce(
    (sum: number, g: any) => sum + (Number(g.goods_count) || 0),
    0
  );
  return {
    platform_order_no: orderSn,
    buyer_nickname: raw.payer_name || raw.buyer_name || '',
    product_name: firstGoods.goods_name || '',
    product_specification: firstGoods.spec || firstGoods.sku_name || '',
    order_quantity: totalQty || 1,
    paid_amount: Number(raw.pay_amount) || 0,
    order_status: PDD_STATUS_MAP[Number(raw.order_status)] || '未知',
    created_at: raw.created_time
      ? new Date(Number(raw.created_time) * 1000).toISOString()
      : new Date().toISOString(),
  };
}

// 调用拼多多订单查询接口（pdd.order.list.get）
async function fetchPinduoduoOrders(auth: PlatformAuth): Promise<OrderResult> {
  if (!auth.app_key || !auth.app_secret || !auth.access_token) {
    return {
      orders: [],
      raw: { error: '缺少拼多多 AppKey/AppSecret/AccessToken' },
    };
  }

  const now = Math.floor(Date.now() / 1000);
  // 拉取最近 24 小时内更新的订单
  const startAt = now - 24 * 60 * 60;
  const endAt = now;

  const baseParams: Record<string, string> = {
    type: 'pdd.order.list.get',
    client_id: auth.app_key,
    access_token: auth.access_token,
    timestamp: String(now),
    data_type: 'JSON',
    order_status: '1', // 1=待发货，2=已发货，3=已完成，5=全部
    refund_query_type: '1',
    start_confirm_at: String(startAt),
    end_confirm_at: String(endAt),
    page: '1',
    page_size: '100',
  };

  const sign = await buildPddSign(baseParams, auth.app_secret);
  const url = new URL(PDD_GATEWAY);
  for (const [k, v] of Object.entries(baseParams)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('sign', sign);

  const resp = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!resp.ok) {
    return {
      orders: [],
      raw: { error: `拼多多接口请求失败: ${resp.status}` },
    };
  }

  const json = await resp.json();

  // 拼多多返回错误码时
  if (json.error_response) {
    return {
      orders: [],
      raw: {
        error: `拼多多接口错误: ${json.error_response.error_msg || ''}`,
        code: json.error_response.error_code,
      },
    };
  }

  const orderList = json?.order_list_get_response?.order_list || [];
  const orders = orderList.map(mapPddOrder);

  return {
    orders,
    raw: {
      total: json?.order_list_get_response?.total_count || orders.length,
      page: 1,
    },
  };
}

function mapToPurchaseTracking(
  auth: PlatformAuth,
  order: SyncOrder,
  existingId?: string
): Record<string, any> {
  return {
    ...(existingId ? { id: existingId } : {}),
    platform_order_no: order.platform_order_no,
    platform_code: auth.platform_code,
    platform_name: auth.platform_name,
    platform_merchant_name: `${auth.platform_name} - ${auth.shop_name}`,
    buyer_nickname: order.buyer_nickname,
    product_name: order.product_name,
    product_specification: order.product_specification,
    order_quantity: order.order_quantity,
    order_status: order.order_status,
    record_date: order.created_at.split('T')[0],
    shipment_quantity:
      order.order_status === '已发货' || order.order_status === '已完成'
        ? order.order_quantity
        : 0,
    return_quantity: 0,
    cutting_quantity: 0,
    production_quantity: 0,
  };
}

async function syncAuthOrders(
  supabase: ReturnType<typeof createClient>,
  auth: PlatformAuth
): Promise<{ success: boolean; synced: number; newOrders: number; updated: number; reason?: string }> {
  const start = Date.now();
  try {
    const { allowed, remaining } = await checkRateLimit(supabase, auth, 1);
    if (!allowed) {
      const reason = `API 调用次数超限，剩余 ${remaining} 次`;
      await logSync(supabase, {
        auth_id: auth.id,
        platform_code: auth.platform_code,
        platform_name: auth.platform_name,
        shop_name: auth.shop_name,
        sync_status: 'failed',
        failed_reason: reason,
        execution_time_ms: Date.now() - start,
      });
      await createAlert(supabase, {
        auth_id: auth.id,
        platform_code: auth.platform_code,
        shop_name: auth.shop_name,
        alert_type: 'rate_limited',
        alert_reason: reason,
      });
      return { success: false, synced: 0, newOrders: 0, updated: 0, reason };
    }

    const { orders, raw } = await fetchOrdersFromPlatform(auth);
    const synced = orders.length;
    let newOrders = 0;
    let updated = 0;

    for (const order of orders) {
      const { data: existing } = await supabase
        .from('ecommerce_purchase_tracking')
        .select('id, order_status, shipment_quantity')
        .eq('platform_order_no', order.platform_order_no)
        .maybeSingle();

      const payload = mapToPurchaseTracking(auth, order, existing?.id);
      if (existing) {
        const statusChanged = existing.order_status !== order.order_status;
        if (statusChanged) {
          await supabase.from('ecommerce_purchase_tracking').update(payload).eq('id', existing.id);
          updated += 1;
        }
      } else {
        await supabase.from('ecommerce_purchase_tracking').insert(payload);
        newOrders += 1;
      }
    }

    await supabase
      .from('ecommerce_platform_auth')
      .update({
        last_synced_at: new Date().toISOString(),
        total_synced_orders: synced,
      })
      .eq('id', auth.id);

    // 同步成功后，将该店铺的同类型告警置为已处理
    await supabase
      .from('ecommerce_alert_log')
      .update({
        alert_status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('auth_id', auth.id)
      .eq('alert_status', 'pending')
      .in('alert_type', ['sync_failed', 'rate_limited', 'token_expired']);

    await logSync(supabase, {
      auth_id: auth.id,
      platform_code: auth.platform_code,
      platform_name: auth.platform_name,
      shop_name: auth.shop_name,
      sync_status: 'success',
      synced_orders: synced,
      new_orders: newOrders,
      updated_orders: updated,
      execution_time_ms: Date.now() - start,
      request_params: { platform_code: auth.platform_code },
      response_data: raw,
    });

    return { success: true, synced, newOrders, updated };
  } catch (err: any) {
    const reason = err.message || '同步异常';
    await logSync(supabase, {
      auth_id: auth.id,
      platform_code: auth.platform_code,
      platform_name: auth.platform_name,
      shop_name: auth.shop_name,
      sync_status: 'failed',
      failed_reason: reason,
      execution_time_ms: Date.now() - start,
    });

    // 连续失败检测
    const { data: recentLogs } = await supabase
      .from('ecommerce_order_sync_log')
      .select('sync_status')
      .eq('auth_id', auth.id)
      .order('created_at', { ascending: false })
      .limit(3);
    if (recentLogs && recentLogs.length >= 3 && recentLogs.every((l) => l.sync_status === 'failed')) {
      await createAlert(supabase, {
        auth_id: auth.id,
        platform_code: auth.platform_code,
        shop_name: auth.shop_name,
        alert_type: 'sync_failed',
        alert_reason: '连续 3 次拉取失败',
      });
    }

    return { success: false, synced: 0, newOrders: 0, updated: 0, reason };
  }
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const supabase = createSupabaseClient();
    const auths = await getActiveAuths(supabase);
    const results = [];
    for (const auth of auths) {
      const result = await syncAuthOrders(supabase, auth);
      results.push({
        platform: auth.platform_name,
        shop: auth.shop_name,
        ...result,
      });
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
