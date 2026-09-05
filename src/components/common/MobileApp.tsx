import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, Factory, Home, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MobileHome } from './MobileHome';
import { MobileProduction } from './MobileProduction';
import { MobileQuality, type InspectionItem } from './MobileQuality';
import { MobileProfile } from './MobileProfile';
import { MobileProductionDetail } from './MobileProductionDetail';
import { MobileQualityDetail } from './MobileQualityDetail';
import { MobileInventory } from './MobileInventory';
import { MobileMarketing } from './MobileMarketing';
import { MobilePurchase } from './MobilePurchase';
import { MobileApprovals } from './MobileApprovals';

function MobileTopBar({ onLogout }: { onLogout?: () => void }) {
  const { profile } = useAuth();
  const displayName = profile?.full_name || profile?.username || '用户';
  return (
    <div className="pointer-events-none absolute right-0 top-0 z-20 flex items-center gap-2 px-4 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="pointer-events-auto flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur active:bg-accent">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {displayName.slice(0, 1)}
            </div>
            <span className="max-w-[8rem] truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            退出账号
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

type Route =
  | { type: 'tab'; tab: string }
  | { type: 'work-order'; id: string }
  | { type: 'inspection'; item: InspectionItem };

const navItems = [
  { key: 'home', label: '首页', icon: Home },
  { key: 'production', label: '生产', icon: Factory },
  { key: 'quality', label: '质量', icon: ClipboardCheck },
  { key: 'profile', label: '我的', icon: User },
];

export function MobileApp({ onLogout }: { onLogout?: () => void }) {
  const navigate = useNavigate();
  const [route, setRoute] = useState<Route>({ type: 'tab', tab: 'home' });

  const handleBack = () => {
    setRoute({ type: 'tab', tab: route.type === 'work-order' ? 'production' : 'quality' });
  };

  const renderTabContent = (tab: string) => {
    const backToHome = () => setRoute({ type: 'tab', tab: 'home' });
    switch (tab) {
      case 'home':
        return <MobileHome onScan={() => navigate('/mobile/scan')} onNavigate={(tab) => setRoute({ type: 'tab', tab })} />;
      case 'production':
        return <MobileProduction onSelect={(id) => setRoute({ type: 'work-order', id })} />;
      case 'quality':
        return <MobileQuality onSelect={(item) => setRoute({ type: 'inspection', item })} />;
      case 'profile':
        return <MobileProfile onLogout={onLogout} />;
      case 'inventory':
        return <MobileInventory onBack={backToHome} />;
      case 'marketing':
        return <MobileMarketing onBack={backToHome} />;
      case 'purchase':
        return <MobilePurchase onBack={backToHome} />;
      case 'approvals':
        return <MobileApprovals onBack={backToHome} />;
      default:
        return <MobileHome onScan={() => navigate('/mobile/scan')} onNavigate={(tab) => setRoute({ type: 'tab', tab })} />;
    }
  };

  const renderContent = () => {
    switch (route.type) {
      case 'tab':
        return renderTabContent(route.tab);
      case 'work-order':
        return <MobileProductionDetail id={route.id} onBack={handleBack} />;
      case 'inspection':
        return <MobileQualityDetail item={route.item} onBack={handleBack} />;
      default:
        return renderTabContent('home');
    }
  };

  const activeTab = route.type === 'tab' ? route.tab : route.type === 'work-order' ? 'production' : route.type === 'inspection' ? 'quality' : 'home';

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[2.2rem] bg-background">
      <MobileTopBar onLogout={onLogout} />
      <div className="flex-1 overflow-y-auto overscroll-contain">{renderContent()}</div>
      {route.type === 'tab' && (
        <div className="flex h-16 shrink-0 items-center justify-around border-t border-border bg-card px-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              className="flex flex-1 flex-col items-center justify-center py-2"
              onClick={() => setRoute({ type: 'tab', tab: item.key })}
            >
              <item.icon className={`h-5 w-5 ${activeTab === item.key ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`mt-1 text-xs ${activeTab === item.key ? 'text-primary' : 'text-muted-foreground'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
