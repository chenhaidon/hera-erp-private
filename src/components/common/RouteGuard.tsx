import { Navigate, useLocation, matchPath } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppStore } from '@/store';
import { routeToMenuKeys } from '@/lib/rbac';

const PUBLIC_ROUTES = ['/login', '/mobile/login', '/register'];
const MOBILE_REDIRECT = '/mobile/home';
const MOBILE_LOGIN = '/mobile/login';

interface RouteConfig {
  path: string;
  children?: { path: string }[];
}

function getParentModulePath(path: string): string {
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return '/';
  return '/' + segments[0];
}

export function RouteGuard({ routes, children }: { routes: RouteConfig[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const moduleVisibility = useAppStore((state) => state.moduleVisibility);
  const role = useAppStore((state) => state.currentRole);
  const rbacPermissions = useAppStore((state) => state.rbacPermissions);

  const isPublic = PUBLIC_ROUTES.some((p) => matchPath(p, location.pathname));

  const allPaths = routes.reduce<string[]>((acc, r) => {
    acc.push(r.path);
    if (r.children) r.children.forEach((c) => acc.push(c.path));
    return acc;
  }, []);
  const isKnown = allPaths.some((p) => matchPath(p, location.pathname));

  const matchedPath = allPaths
    .filter((p) => matchPath(p, location.pathname))
    .sort((a, b) => b.split('/').filter(Boolean).length - a.split('/').filter(Boolean).length)[0];
  const isHidden = (() => {
    if (!matchedPath) return false;
    const parent = getParentModulePath(matchedPath);
    if (parent !== '/' && moduleVisibility.modules[parent] === false) return true;
    if (matchedPath !== parent && moduleVisibility.menus[matchedPath] === false) return true;
    return false;
  })();

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // RBAC 路由拦截：角色已配置权限时，无查看权限的路径强制跳转首页（防 URL 越权）
  // 首页恒可见，不纳入 RBAC 拦截，避免无首页权限时死循环重定向
  const rbacDenied = (() => {
    if (location.pathname === '/' || location.pathname === '') return false;
    const cfg = rbacPermissions[role];
    if (!user || role === 'admin' || !cfg || Object.keys(cfg.buttons).length === 0) return false;
    const menuKeys = routeToMenuKeys(location.pathname);
    if (!menuKeys.length) return false; // 非业务路径或移动端不拦截
    const permitted = menuKeys.some((k) => (cfg.buttons[k] || []).includes('view'));
    return !permitted;
  })();

  if (loading) return <div className="flex h-screen items-center justify-center text-muted-foreground">加载中...</div>;
  if (!user && !isPublic) {
    const isMobileRoute = location.pathname.startsWith('/mobile/');
    const redirectTo = isMobileRoute ? MOBILE_LOGIN : '/login';
    return <Navigate to={redirectTo} state={{ from: location.pathname + location.search }} replace />;
  }
  if (user && isPublic) {
    const fallback = isMobile ? MOBILE_REDIRECT : '/';
    return <Navigate to={fallback} replace />;
  }
  if (user && isMobile && location.pathname === '/') {
    return <Navigate to={MOBILE_REDIRECT} replace />;
  }
  if (!isKnown && location.pathname !== '/login' && location.pathname !== '/register') {
    return <Navigate to="/" replace />;
  }
  if (isHidden) {
    return <Navigate to="/" replace />;
  }
  if (rbacDenied) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
