import { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import Taro from '@tarojs/taro';
import { supabase } from '@/client/supabase';
import type { Profile } from '@/db/types';

interface AuthContextValue {
  user: Profile | null;
  session: any;
  isLoading: boolean;
  agreed: boolean;
  setAgreed: (value: boolean) => void;
  signInWithUsername: (username: string, password: string) => Promise<{ error?: Error }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error?: Error }>;
  signInWithWechat: () => Promise<{ error?: Error }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [agreed, setAgreedState] = useState(false);

  useEffect(() => {
    const agreedValue = Taro.getStorageSync('privacy_agreed') === true;
    setAgreedState(agreedValue);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      else setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const setAgreed = (value: boolean) => {
    Taro.setStorageSync('privacy_agreed', value);
    setAgreedState(value);
  };

  const loadProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setUser(data as Profile | null);
    setIsLoading(false);
  };

  const signInWithUsername = async (username: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username}@miaoda.com`,
      password,
    });
    return { error: error ?? undefined };
  };

  const signUpWithUsername = async (username: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email: `${username}@miaoda.com`,
      password,
      options: { data: { username } },
    });
    return { error: error ?? undefined };
  };

  const signInWithWechat = async () => {
    try {
      const loginRes = await Taro.login();
      const { data, error } = await supabase.functions.invoke('wechat_miniapp_login', {
        body: { code: loginRes.code },
      });
      if (error) return { error };
      if (!data?.token) return { error: new Error('微信登录失败') };
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: 'magiclink',
      });
      return { error: verifyError ?? undefined };
    } catch (err: any) {
      return { error: err };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    Taro.removeStorageSync('loginRedirectPath');
    Taro.reLaunch({ url: '/pages/login/index' });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        agreed,
        setAgreed,
        signInWithUsername,
        signUpWithUsername,
        signInWithWechat,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
