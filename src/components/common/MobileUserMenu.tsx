import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MobileUserMenu() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const emailUsername = user?.email?.split('@')[0];
  const displayName =
    profile?.full_name ||
    profile?.username ||
    emailUsername ||
    '用户';

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full bg-card px-2 py-1 text-foreground shadow-sm active:opacity-80">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {displayName.slice(0, 1)}
          </div>
          <span className="max-w-[8rem] truncate text-sm font-medium">{displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          退出账号
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}