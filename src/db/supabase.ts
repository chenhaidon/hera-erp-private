import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // 使用空锁函数绕过 Web Locks API，避免多 Tab/多请求场景下锁被 steal 导致 AbortError。
    // 单页应用内单个客户端实例已足够避免并发冲突。
    lock: async <R,>(_name: string, _acquireTimeout: number, fn: () => Promise<R>) => {
      return await fn();
    },
  },
});
