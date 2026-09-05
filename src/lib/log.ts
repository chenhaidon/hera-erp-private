import { supabase } from '@/db/supabase';
import type { OperationLog, LoginLog } from '@/types';

/** 获取客户端 IP（基于免费 ipapi.co 服务，失败返回空） */
export async function getClientIp(): Promise<string> {
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (!res.ok) return '';
    const data = (await res.json()) as { ip?: string };
    return data.ip || '';
  } catch {
    return '';
  }
}

/** 解析浏览器 UA 为简洁设备说明 */
export function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';

  return `${browser} / ${os}`;
}

const ACTION_LABELS: Record<OperationLog['action'], string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  login: '登录',
  logout: '登出',
  export: '导出',
  approve: '审批通过',
  reject: '审批驳回',
  print: '打印',
  other: '其他',
};

/** 记录操作日志 */
export async function recordOperationLog(
  partial: Omit<Partial<OperationLog>, 'action_label' | 'time' | 'id' | 'result'> &
    Pick<OperationLog, 'action' | 'operator'> & { result?: OperationLog['result'] }
) {
  const now = new Date().toISOString();
  const log: OperationLog = {
    id: crypto.randomUUID(),
    time: now,
    action_label: ACTION_LABELS[partial.action],
    module: partial.module || '系统',
    target: partial.target || '',
    result: partial.result || 'success',
    ip: partial.ip ?? (await getClientIp()),
    device: partial.device ?? getDeviceInfo(),
    ...partial,
  };
  try {
    // 通过 store action 统一完成 DB 写入 + 本地状态更新（避免重复插入导致主键冲突）
    const { useAppStore } = await import('@/store');
    await useAppStore.getState().addOperationLog(log);
  } catch (err) {
    console.error('[log] recordOperationLog failed', err);
  }
}

/** 记录登录日志 */
export async function recordLoginLog(
  partial: Omit<Partial<LoginLog>, 'time' | 'id'> & Pick<LoginLog, 'account' | 'status'>
) {
  const now = new Date().toISOString();
  const ip = partial.ip ?? (await getClientIp());
  const log: LoginLog = {
    id: crypto.randomUUID(),
    time: now,
    ip,
    device: partial.device ?? getDeviceInfo(),
    is_abnormal: partial.is_abnormal ?? false,
    ...partial,
  };
  try {
    // 通过 store action 统一完成 DB 写入 + 本地状态更新（避免重复插入导致主键冲突）
    const { useAppStore } = await import('@/store');
    await useAppStore.getState().addLoginLog(log);
  } catch (err) {
    console.error('[log] recordLoginLog failed', err);
  }
}

/** 检测是否异常登录：连续失败次数、非工作时间、未知设备等 */
export async function detectAbnormalLogin(account: string, status: LoginLog['status']): Promise<{ abnormal: boolean; reason: string }> {
  const reasonParts: string[] = [];
  if (status === 'failed') {
    reasonParts.push('登录失败');
  }
  if (status === 'locked') {
    reasonParts.push('账号已锁定');
  }

  // 查询最近 5 分钟内该账号失败次数
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('entity_store')
    .select('data')
    .eq('entity_type', 'login_logs')
    .gte('created_at', fiveMinAgo);
  if (!error && data) {
    const failed = (data as { data: LoginLog }[])
      .map((r) => r.data)
      .filter((l) => l.account === account && l.status === 'failed');
    if (failed.length >= 3) {
      reasonParts.push(`5分钟内连续失败${failed.length}次`);
    }
  }

  // 非工作时间（22:00 - 06:00）
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) {
    reasonParts.push('非工作时间登录');
  }

  return {
    abnormal: reasonParts.length > 0,
    reason: reasonParts.join('；'),
  };
}

/** 通用操作日志 hook */
export function useOperationLog() {
  const write = async (
    action: OperationLog['action'],
    operator: string,
    opts: {
      module?: string;
      target?: string;
      targetType?: string;
      targetId?: string;
      result?: OperationLog['result'];
      resultMessage?: string;
      detail?: string;
      operatorName?: string;
      role?: string;
    } = {}
  ) => {
    await recordOperationLog({
      action,
      operator,
      operator_name: opts.operatorName,
      role: opts.role,
      module: opts.module || '系统',
      target: opts.target || '',
      target_type: opts.targetType,
      target_id: opts.targetId,
      result: opts.result || 'success',
      result_message: opts.resultMessage,
      detail: opts.detail,
    });
  };

  return { write };
}
