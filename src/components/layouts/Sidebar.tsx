import { useAppStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  GripVertical,
  RotateCcw,
  ChevronDown,
  Search,
  Package,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { supabase } from '@/db/supabase';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import { defaultNavItems, defaultMenuItems, type NavItem, type NavSubItem } from '@/lib/navConfig';
import { RBAC_MODULES } from '@/lib/rbac';
import type { AppRole } from '@/lib/permissions';

function useSiteSettings() {
  const [siteName, setSiteName] = useState('浦江家纺');
  const [siteSubName, setSiteSubName] = useState('智造管理平台');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    supabase
      .from('site_settings')
      .select('key, value')
      .then(({ data, error }) => {
        if (error) return;
        const map: Record<string, string> = {};
        data?.forEach((item) => {
          if (item.value) map[item.key] = item.value;
        });
        if (map.site_name) {
          const name = map.site_name;
          const mid = Math.ceil(name.length / 2);
          setSiteName(name.slice(0, mid));
          setSiteSubName(name.slice(mid));
        }
        if (map.site_short_name) {
          setSiteName(map.site_short_name);
          setSiteSubName('');
        }
        if (map.site_logo_url) setLogoUrl(map.site_logo_url);
      });
  }, []);

  return { siteName, siteSubName, logoUrl };
}

function filterSubItems(children: NavSubItem[], q: string): NavSubItem[] {
  return children.reduce<NavSubItem[]>((acc, child) => {
    if (child.label.toLowerCase().includes(q)) {
      acc.push(child);
      return acc;
    }
    if (child.children) {
      const nested = filterSubItems(child.children, q);
      if (nested.length) acc.push({ ...child, children: nested });
    }
    return acc;
  }, []);
}

function filterNavItemsByQuery(items: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.reduce<NavItem[]>((acc, item) => {
    if (item.label.toLowerCase().includes(q)) {
      acc.push(item);
      return acc;
    }
    if (item.children) {
      const children = filterSubItems(item.children, q);
      if (children.length) acc.push({ ...item, children });
    }
    return acc;
  }, []);
}

function buildDefaultItems(): NavItem[] {
  return defaultNavItems.map((item) => {
    const sub = defaultMenuItems[item.path];
    return sub && sub.length > 0 ? { ...item, children: sub } : item;
  });
}

function applyNavOrder(items: NavItem[], order: string[] | null | undefined): NavItem[] {
  if (!order || !order.length) return items;
  const map = new Map(items.map((item) => [item.path, item]));
  const ordered = order
    .map((path) => map.get(path))
    .filter((item): item is NavItem => Boolean(item));
  const orderedPaths = new Set(order);
  const missing = items.filter((item) => !orderedPaths.has(item.path));
  return [...ordered, ...missing];
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const store = useAppStore();
  const { profile } = useAuth();
  const role = store.currentRole;
  const rbacPerms = store.rbacPermissions;
  const { siteName, siteSubName, logoUrl } = useSiteSettings();
  const { moduleVisibility } = store;
  const [items, setItems] = useState<NavItem[]>(() =>
    applyNavOrder(buildDefaultItems(), profile?.nav_order)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const searching = searchQuery.trim().length > 0;

  const roleFiltered = useMemo(() => {
    // 1) RBAC 过滤：未配置角色保持开放（兼容）；配置后按 view 权限过滤
    const rbacFiltered = (() => {
      const cfg = rbacPerms[role];
      if (role === 'admin' || !cfg || Object.keys(cfg.buttons).length === 0) return items;
      const canViewMenu = (path: string): boolean => {
        const segs = path.split('/').filter(Boolean);
        if (!segs.length) return true; // 首页恒可见
        const modKey = segs[0];
        const mod = RBAC_MODULES.find((m) => m.key === modKey);
        if (!mod) return true;
        if (segs.length >= 2) {
          const exact = `${modKey}-${segs[1]}`;
          if (mod.menus.some((m) => m.key === exact)) return (cfg.buttons[exact] || []).includes('view');
        }
        return mod.menus.some((m) => (cfg.buttons[m.key] || []).includes('view'));
      };
      const filterSubs = (subs: NavSubItem[]): NavSubItem[] =>
        subs.filter((c) => canViewMenu(c.path));
      return items
        .map((item) => ({ ...item, children: item.children ? filterSubs(item.children) : undefined }))
        .filter((item) => canViewMenu(item.path) || (item.children && item.children.length > 0))
        .map((item) => ({ ...item, children: item.children?.length ? item.children : item.children }));
    })();
    // 2) 原有静态角色限制（如系统管理仅 admin）
    const roleFilteredItems = rbacFiltered.filter((item) => !item.roles || item.roles.includes(role));
    // 3) 模块可见性过滤
    return roleFilteredItems
      .filter((item) => {
        if (item.path === '/') return true;
        if (moduleVisibility.modules[item.path] === false) return false;
        if (!item.children) return true;
        const visibleChildren = item.children.filter((child) => moduleVisibility.menus[child.path] !== false);
        return visibleChildren.length > 0;
      })
      .map((item) => ({
        ...item,
        children: item.children?.filter((child) => moduleVisibility.menus[child.path] !== false),
      }));
  }, [role, rbacPerms, items, moduleVisibility]);

  const visibleItems = useMemo(
    () => filterNavItemsByQuery(roleFiltered, searchQuery),
    [roleFiltered, searchQuery]
  );

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    defaultNavItems.forEach((item) => {
      if (defaultMenuItems[item.path]) {
        initial[item.path] = pathname.startsWith(item.path);
      }
    });
    return initial;
  });

  async function saveNavOrder(next: NavItem[]) {
    if (!profile?.id) return;
    const order = next.map((item) => item.path);
    const { error } = await supabase
      .from('profiles')
      .update({ nav_order: order })
      .eq('id', profile.id);
    if (error) {
      console.error('保存导航排序失败', error);
    }
  }

  function handleDragStart(index: number) {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setDragIndex(index);
    setItems(next);
  }

  function handleDragEnd() {
    setDragIndex(null);
    saveNavOrder(items);
  }

  function resetOrder() {
    const next = buildDefaultItems();
    setItems(next);
    if (profile?.id) {
      supabase.from('profiles').update({ nav_order: null }).eq('id', profile.id).then(({ error }) => {
        if (error) console.error('重置导航排序失败', error);
      });
    }
  }

  function toggleGroup(path: string) {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));
  }

  function renderChildren(children: NavSubItem[], onNavigate: (() => void) | undefined, role: AppRole) {
    return children
      .filter((child) => !child.roles || child.roles.includes(role))
      .map((child) => {
        const childActive = pathname === child.path;
        if (child.children) {
          const open = searching ? true : !!expanded[child.path];
          const childGroupActive = pathname.startsWith(child.path);
          return (
            <div key={child.path} className="flex flex-col">
              <button
                type="button"
                onClick={() => toggleGroup(child.path)}
                className={cn(
                  'flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  childGroupActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                )}
              >
                <span className="flex-1 text-left">{child.label}</span>
                <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {renderChildren(child.children, onNavigate, role)}
                </div>
              )}
            </div>
          );
        }
        return (
          <NavLink
            key={child.path}
            to={child.path}
            onClick={onNavigate}
            className={cn(
              'block rounded-md px-3 py-2 text-sm transition-colors',
              childActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
            )}
          >
            {child.label}
          </NavLink>
        );
      });
  }

  return (
    <div className="flex h-full flex-col gap-2 py-4">
      <div className="flex items-center gap-3 px-4 pb-4">
        {logoUrl ? (
          <Avatar className="h-10 w-10 shrink-0 rounded-lg border bg-background">
            <AvatarImage src={logoUrl} alt={siteName} className="object-contain p-1" />
            <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
              <Package className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
        )}
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-base font-semibold leading-tight">{siteName}</span>
          {siteSubName && <span className="truncate text-xs text-muted-foreground">{siteSubName}</span>}
        </div>
        <div className="ml-auto">
          <ThemeSwitcher />
        </div>
      </div>
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索菜单"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto">
        {visibleItems.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted-foreground">未找到匹配的菜单</div>
        )}
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const hasChildren = (defaultMenuItems[item.path]?.length ?? 0) > 0;
          const active =
            item.path === '/'
              ? pathname === '/'
              : pathname === item.path || (hasChildren && pathname.startsWith(item.path + '/'));
          return (
            <div key={item.path} className="flex flex-col">
              <div className="group flex items-center">
                {!searching && (
                  <span
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100"
                    aria-label="拖动排序"
                  >
                    <GripVertical className="h-3.5 w-3.5" />
                  </span>
                )}
                <NavLink
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    'flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                </NavLink>
                {item.children && !searching && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.path)}
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors',
                      active ? 'text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground hover:bg-muted'
                    )}
                    aria-label={expanded[item.path] ? '折叠子菜单' : '展开子菜单'}
                  >
                    <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', expanded[item.path] && 'rotate-180')} />
                  </button>
                )}
              </div>
              {item.children && (searching ? true : !!expanded[item.path]) && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-2">
                  {renderChildren(item.children, onNavigate, store.currentRole)}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="px-4 pt-2">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={resetOrder}>
          <RotateCcw className="h-4 w-4" />恢复默认排序
        </Button>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        <SidebarContent />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon" className="fixed left-4 top-3 z-50">
            <Menu className="h-5 w-5" />
            <span className="sr-only">打开菜单</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <div className="flex items-center justify-end px-4 pt-4">
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
