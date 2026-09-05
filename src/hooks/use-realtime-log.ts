// 实时日志订阅 Hook：订阅 entity_store 表指定 entityType 的 INSERT/UPDATE 事件
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/db/supabase';

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected';

interface RealtimePayload {
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

interface UseRealtimeLogOptions {
  /** entity_store 中的实体类型，如 login_logs / operation_logs */
  entityType: string;
  /** 收到新插入记录时的回调 */
  onInsert?: (record: Record<string, unknown>) => void;
  /** 收到更新记录时的回调 */
  onUpdate?: (record: Record<string, unknown>) => void;
  /** 是否启用订阅 */
  enabled?: boolean;
}

/**
 * 订阅 entity_store 的实时变更（按 entityType 过滤）。
 * 返回连接状态；页面卸载时自动取消订阅。
 */
export function useRealtimeLog({ entityType, onInsert, onUpdate, enabled = true }: UseRealtimeLogOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const callbacksRef = useRef({ onInsert, onUpdate });
  callbacksRef.current = { onInsert, onUpdate };

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      return;
    }

    const channel = supabase
      .channel(`realtime-${entityType}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'entity_store',
          filter: `entity_type=eq.${entityType}`,
        },
        (payload: unknown) => {
          const p = payload as RealtimePayload;
          if (p.eventType === 'INSERT') {
            callbacksRef.current.onInsert?.(p.new?.data as Record<string, unknown> || {});
          } else if (p.eventType === 'UPDATE') {
            callbacksRef.current.onUpdate?.(p.new?.data as Record<string, unknown> || {});
          }
        }
      )
      .on('broadcast', { event: 'ws-status' }, ({ payload }: { payload: { status: RealtimeStatus } }) => {
        setStatus(payload.status);
      })
      .subscribe((wsStatus: string) => {
        if (wsStatus === 'SUBSCRIBED') {
          setStatus('connected');
        } else if (wsStatus === 'CHANNEL_ERROR' || wsStatus === 'TIMED_OUT' || wsStatus === 'CLOSED') {
          setStatus('disconnected');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [entityType, enabled]);

  return status;
}
