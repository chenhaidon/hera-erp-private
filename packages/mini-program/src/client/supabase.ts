import { createClient } from '@supabase/supabase-js';
import Taro from '@tarojs/taro';

const supabaseUrl = process.env.TARO_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.TARO_APP_SUPABASE_ANON_KEY;

const customFetch = (url: RequestInfo | URL, options?: RequestInit): Promise<Response> => {
  return new Promise((resolve, reject) => {
    Taro.request({
      url: url.toString(),
      method: (options?.method || 'GET') as any,
      data: options?.body,
      header: options?.headers as any,
      success: (res) => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: '',
          headers: new Headers(res.header),
          url: url.toString(),
          text: () => Promise.resolve(typeof res.data === 'string' ? res.data : JSON.stringify(res.data)),
          json: () => Promise.resolve(typeof res.data === 'string' ? JSON.parse(res.data) : res.data),
        } as Response);
      },
      fail: (err) => reject(err),
    });
  });
};

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: {
      getItem: (key) => Taro.getStorageSync(key),
      setItem: (key, value) => Taro.setStorageSync(key, value),
      removeItem: (key) => Taro.removeStorageSync(key),
    },
  },
  global: {
    fetch: customFetch,
  },
});
