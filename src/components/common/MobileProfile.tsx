import { Bell, ChevronRight, FileText, LogOut, Settings, Shield, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export function MobileProfile({ onLogout }: { onLogout?: () => void }) {
  const { user, signOut } = useAuth();

  const menuItems = [
    { icon: Settings, label: '设置', onPress: () => alert('设置功能演示') },
    { icon: Shield, label: '隐私设置', onPress: () => alert('隐私设置功能演示') },
    { icon: FileText, label: '双清单', onPress: () => alert('双清单功能演示') },
    { icon: Bell, label: '消息通知', onPress: () => alert('消息通知功能演示') },
  ];

  const handleLogout = async () => {
    await signOut();
    onLogout?.();
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background p-4 pb-6">
      <Card className="mb-6 flex flex-row items-center p-4">
        <div className="mr-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
          <User className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-lg font-bold text-foreground">{user?.phone || user?.email?.split('@')[0] || '未登录'}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">车间主管</p>
        </div>
      </Card>

      <Card className="mb-6 overflow-hidden p-0">
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            className={`flex w-full flex-row items-center px-4 py-4 active:bg-muted/50 ${index !== menuItems.length - 1 ? 'border-b border-border' : ''}`}
            onClick={item.onPress}
          >
            <item.icon className="h-5 w-5 text-primary" />
            <span className="ml-3 flex-1 text-left text-base text-foreground">{item.label}</span>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </Card>

      <button
        className="flex flex-row items-center justify-center rounded-2xl border border-border bg-card py-4 active:opacity-90"
        onClick={handleLogout}
      >
        <LogOut className="h-5 w-5 text-destructive" />
        <span className="ml-2 text-base font-semibold text-destructive">退出登录</span>
      </button>
    </div>
  );
}
