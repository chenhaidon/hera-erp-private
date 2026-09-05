import { useState } from 'react';
import { Bell, User, LogOut, LogIn, Smartphone, Check, AlertTriangle, Package, Shield, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { MobilePreview } from '@/components/common/MobilePreview';
import { useAppStore } from '@/store';
import type { AlertNotification } from '@/types';
import { toast } from 'sonner';

function NotificationIcon({ type }: { type: AlertNotification['type'] }) {
  switch (type) {
    case 'inventory_low':
    case 'inventory_dead':
      return <Package className="h-4 w-4 text-amber-500" />;
    case 'patrol_overdue':
      return <ClipboardList className="h-4 w-4 text-blue-500" />;
    case 'safety_hazard':
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

export function Header({ className }: { className?: string }) {
  const { user, profile, signOut } = useAuth();
  const store = useAppStore();
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const notifications = store.alertNotifications || [];
  const unread = notifications.filter((n) => n.status === 'unread');
  const unreadCount = unread.length;

  return (
    <header className={cn('h-14 border-b border-border bg-card px-4 md:px-6', className)}>
      <div className="flex h-full items-center justify-between gap-4">
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <Sheet open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="模拟 APP 预览">
                <Smartphone className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-[400px] border-l border-border bg-muted/50 p-0 sm:max-w-[400px]">
              <SheetHeader className="sr-only">
                <SheetTitle>模拟 APP 预览</SheetTitle>
              </SheetHeader>
              <div className="flex h-full flex-col items-center justify-center p-6">
                <div className="relative rounded-[3rem] border-[8px] border-foreground/10 bg-foreground/5 p-2 shadow-2xl">
                  <div className="absolute left-1/2 top-3 h-1.5 w-20 -translate-x-1/2 rounded-full bg-foreground/20" />
                  <div className="h-[700px] w-[320px] overflow-hidden rounded-[2.2rem] bg-background">
                    <MobilePreview onLoginSuccess={() => setMobilePreviewOpen(false)} />
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">移动端效果预览</p>
              </div>
            </SheetContent>
          </Sheet>
          {user && (
            <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="通知">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  <span className="sr-only">通知</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-sm font-semibold">通知</span>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto py-1 px-2 text-xs"
                      onClick={() => {
                        store.markAllAlertsRead();
                        toast.success('已标记所有通知为已读');
                      }}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      全部已读
                    </Button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      暂无通知
                    </div>
                  ) : (
                    notifications
                      .slice()
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className={cn(
                            'flex items-start gap-3 px-3 py-3 cursor-pointer',
                            n.status === 'unread' && 'bg-muted/50'
                          )}
                          onClick={() => {
                            if (n.status === 'unread') {
                              store.markAlertRead(n.id);
                            }
                          }}
                        >
                          <div className="mt-0.5 shrink-0">
                            <NotificationIcon type={n.type} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={cn('text-sm truncate', n.status === 'unread' ? 'font-semibold' : 'font-medium')}>
                                {n.title}
                              </p>
                              {n.status === 'unread' && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                              {n.content}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {n.created_at}
                            </p>
                          </div>
                        </DropdownMenuItem>
                      ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <span className="hidden text-sm font-medium md:inline">{profile?.full_name || profile?.username || '用户'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  个人中心
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login"><LogIn className="mr-2 h-4 w-4" />登录</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
