import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/db/supabase';
import type { User } from '@supabase/supabase-js';
import type { AppRole } from '@/lib/permissions';
import { useAppStore } from '@/store';
import { toast } from 'sonner';
import { recordLoginLog, recordOperationLog, detectAbnormalLogin } from '@/lib/log';
import { setOperator } from '@/lib/operator';
import { loadRbacConfig } from '@/lib/rbac';

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  email: string | null;
  role: AppRole;
  status: string;
  login_expires_at: string | null;
  nav_order?: string[] | null;
}

const SESSION_VALID_DAYS = 3;
const SESSION_VALID_MS = SESSION_VALID_DAYS * 24 * 60 * 60 * 1000;

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error?: Error }>;
  signUp: (username: string, password: string) => Promise<{ error?: Error }>;
  signInWithOtp: (phone: string) => Promise<{ error?: Error }>;
  signInWithPhone: (phone: string, token: string) => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
  refreshLoginExpiry: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();
    if (error || !data) {
      setProfile(null);
      return;
    }
    const p = data as Profile;

    const now = Date.now();

    // 首次检测到空过期时间时，自动续期 3 天（兼容历史会话）
    if (!p.login_expires_at) {
      const newExpiresAt = new Date(now + SESSION_VALID_MS).toISOString();
      await supabase.from('profiles').update({ login_expires_at: newExpiresAt }).eq('id', uid);
      p.login_expires_at = newExpiresAt;
    }

    // 登录已过期时强制登出
    const expiresAt = new Date(p.login_expires_at).getTime();
    if (expiresAt <= now) {
      await supabase.auth.signOut();
      setProfile(null);
      setUser(null);
      toast.info('登录已过期，请重新登录');
      return;
    }

    setProfile(p);
    setOperator({ username: p.username || '', fullName: p.full_name || '', role: p.role });
    useAppStore.getState().setCurrentRole(p.role);
    // 登录后加载 RBAC 权限配置（菜单/按钮/数据权限）
    void loadRbacConfig();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setOperator(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  /** 记录登录日志（含异常检测），失败不阻塞登录主流程 */
  async function writeLoginLog(account: string, status: 'success' | 'failed', opts: { userName?: string; reason?: string } = {}) {
    try {
      const abnormal = await detectAbnormalLogin(account, status);
      await recordLoginLog({
        account,
        status,
        user_name: opts.userName || account,
        reason: opts.reason || (status === 'success' ? '登录成功' : '登录失败'),
        is_abnormal: abnormal.abnormal,
        abnormal_reason: abnormal.abnormal ? abnormal.reason : '',
      });
    } catch (err) {
      console.error('[auth] writeLoginLog failed', err);
    }
  }

  async function signIn(username: string, password: string) {
    const email = `${username}@miaoda.com`;

    // 1. 先尝试正常 Supabase Auth 登录
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      const expiresAt = new Date(Date.now() + SESSION_VALID_MS).toISOString();
      await supabase.from('profiles').update({ login_expires_at: expiresAt }).eq('id', data.user.id);
      void writeLoginLog(username, 'success');
      return {};
    }

    // 2. Supabase Auth 失败 → 查 entity_store 中的 system_users 做凭证验证
    const { data: rows } = await supabase
      .from('entity_store')
      .select('data')
      .eq('entity_type', 'system_users');

    type SysUser = { id: string; name: string; account: string; role: string; roles?: string[]; status: string; password?: string; employee_id?: string };
    const matched = (rows || [])
      .map(r => r.data as SysUser)
      .find(u => u.account === username && (u.password || '123456') === password && u.status === 'active');

    if (!matched) {
      void writeLoginLog(username, 'failed', { reason: error?.message || '账号或密码错误' });
      return { error: new Error(error?.message || '账号或密码错误') };
    }

    // 3. 懒注册：在 Supabase Auth 自动创建该账号（首次登录时执行一次）
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError && !signUpError.message.includes('already registered')) {
      void writeLoginLog(username, 'failed', { reason: signUpError.message });
      return { error: new Error(signUpError.message) };
    }

    const authUser = signUpData?.user;
    if (authUser) {
      // 角色映射：system_users 角色 → AppRole
      const roleMap: Record<string, string> = {
        '管理员': 'admin', '生产主管': 'production', '质检员': 'quality',
        '财务人员': 'finance', '仓库管理员': 'warehouse', '销售': 'sales',
        '生产人员': 'production', '外协管理': 'outsourcing', '设备运维': 'maintenance',
      };
      const appRole = roleMap[matched.role] || 'production';
      const expiresAt = new Date(Date.now() + SESSION_VALID_MS).toISOString();
      await supabase.from('profiles').upsert({
        id: authUser.id,
        username,
        full_name: matched.name,
        role: appRole,
        status: 'active',
        login_expires_at: expiresAt,
      });
    }

    // 4. 创建后再次登录
    const { data: data2, error: error2 } = await supabase.auth.signInWithPassword({ email, password });
    if (!error2 && data2.user) {
      const expiresAt = new Date(Date.now() + SESSION_VALID_MS).toISOString();
      await supabase.from('profiles').update({ login_expires_at: expiresAt }).eq('id', data2.user.id);
      void writeLoginLog(username, 'success', { userName: matched.name });
      return {};
    }
    void writeLoginLog(username, 'failed', { userName: matched.name, reason: error2?.message || '登录失败，请重试' });
    return { error: new Error(error2?.message || '登录失败，请重试') };
  }

  async function signUp(username: string, password: string) {
    const email = `${username}@miaoda.com`;
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error ? new Error(error.message) : undefined };
  }

  async function signInWithOtp(phone: string) {
    const { error } = await supabase.auth.signInWithOtp({ phone: `+86${phone}` });
    return { error: error ? new Error(error.message) : undefined };
  }

  async function signInWithPhone(phone: string, token: string) {
    const { data, error } = await supabase.auth.verifyOtp({ phone: `+86${phone}`, token, type: 'sms' });
    if (!error && data.user) {
      const expiresAt = new Date(Date.now() + SESSION_VALID_MS).toISOString();
      await supabase.from('profiles').update({ login_expires_at: expiresAt }).eq('id', data.user.id);
      void writeLoginLog(phone, 'success', { reason: '手机号验证码登录成功' });
    } else if (error) {
      void writeLoginLog(phone, 'failed', { reason: error.message });
    }
    return { error: error ? new Error(error.message) : undefined };
  }

  async function signOut() {
    const account = profile?.username || user?.email?.split('@')[0] || '';
    const userName = profile?.full_name || '';
    if (account) {
      await recordLoginLog({ account, status: 'logout', user_name: userName, reason: '用户主动登出' });
      await recordOperationLog({
        action: 'logout',
        operator: account,
        operator_name: userName,
        module: '系统',
        target: '用户登出',
        result: 'success',
      });
    }
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  async function refreshLoginExpiry() {
    const currentUser = user ?? (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) return;
    const expiresAt = new Date(Date.now() + SESSION_VALID_MS).toISOString();
    const { error } = await supabase.from('profiles').update({ login_expires_at: expiresAt }).eq('id', currentUser.id);
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, login_expires_at: expiresAt } : prev));
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signInWithOtp, signInWithPhone, signOut, refreshLoginExpiry }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
