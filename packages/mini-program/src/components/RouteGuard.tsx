import { useEffect } from 'react';
import Taro from '@tarojs/taro';
import { useAuth } from '@/contexts/AuthContext';

export const PUBLIC_PAGE_PATHS = ['/pages/login/index', '/pages/privacy/index', '/pages/double-list/index'];

export function withRouteGuard<P extends object>(Component: React.ComponentType<P>) {
  return function GuardedComponent(props: P) {
    const { session, isLoading } = useAuth();

    useEffect(() => {
      if (isLoading) return;
      const instance = Taro.getCurrentInstance();
      const path = instance?.router?.path || '';
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const isPublic = PUBLIC_PAGE_PATHS.includes(normalizedPath);
      if (!session && !isPublic) {
        Taro.setStorageSync('loginRedirectPath', normalizedPath);
        Taro.redirectTo({ url: '/pages/login/index' });
      }
    }, [session, isLoading]);

    if (isLoading) return null;
    return <Component {...props} />;
  };
}
