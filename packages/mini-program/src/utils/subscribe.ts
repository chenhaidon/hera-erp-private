import Taro from '@tarojs/taro';

const SUBSCRIBE_IDS: string[] = [];

export async function requestSubscribeMessage() {
  if (SUBSCRIBE_IDS.length === 0) return;
  try {
    const res = await Taro.requestSubscribeMessage({
      tmplIds: SUBSCRIBE_IDS,
      entityIds: [],
    } as any);
    const accepted = Object.entries(res).filter(([_, v]) => v === 'accept').map(([k]) => k);
    Taro.setStorageSync('subscribed_message_ids', accepted);
  } catch (err) {
    console.error('订阅消息失败', err);
  }
}

export function hasSubscribed(id: string) {
  const list: string[] = Taro.getStorageSync('subscribed_message_ids') || [];
  return list.includes(id);
}
