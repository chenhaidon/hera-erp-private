import Taro from '@tarojs/taro';

const CACHE_PREFIX = 'jljy_cache_';

export function getCache<T>(key: string): T | null {
  try {
    const raw = Taro.getStorageSync(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expire && parsed.expire < Date.now()) {
      Taro.removeStorageSync(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlMinutes = 30) {
  try {
    Taro.setStorageSync(
      `${CACHE_PREFIX}${key}`,
      JSON.stringify({ data, expire: Date.now() + ttlMinutes * 60 * 1000 }),
    );
  } catch {
    // ignore
  }
}

export function clearCache(key?: string) {
  if (key) {
    Taro.removeStorageSync(`${CACHE_PREFIX}${key}`);
  } else {
    const keys = Taro.getStorageInfoSync().keys || [];
    keys.forEach((k) => {
      if (k.startsWith(CACHE_PREFIX)) Taro.removeStorageSync(k);
    });
  }
}

export async function withOfflineFallback<T>(key: string, fetcher: () => Promise<T>, ttlMinutes = 30): Promise<T> {
  try {
    const data = await fetcher();
    setCache(key, data, ttlMinutes);
    return data;
  } catch {
    const cached = getCache<T>(key);
    if (cached) return cached;
    throw new Error('网络异常，且无本地缓存');
  }
}
