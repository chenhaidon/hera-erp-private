import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PurchaseTrackingTab from '@/components/ecommerce/PurchaseTrackingTab';
import PlatformAuthTab from '@/components/ecommerce/PlatformAuthTab';
import OrderSyncLogTab from '@/components/ecommerce/OrderSyncLogTab';

const TABS = [
  { key: 'purchase-tracking', label: '采购发货跟踪单' },
  { key: 'platform-auth', label: '平台授权管理' },
  { key: 'order-sync-log', label: '订单拉取日志' },
];

export default function EcommercePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'purchase-tracking';

  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="space-y-4 p-6">
      <PageHeader title="电商业务" description="电商平台采购发货跟踪与订单自动拉取" />
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-muted">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="purchase-tracking">
          <PurchaseTrackingTab />
        </TabsContent>
        <TabsContent value="platform-auth">
          <PlatformAuthTab />
        </TabsContent>
        <TabsContent value="order-sync-log">
          <OrderSyncLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
