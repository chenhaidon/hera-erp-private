import { Truck } from 'lucide-react';
import { Card } from '@/components/ui/card';

export function MobilePurchase({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background px-4 pb-3 pt-6">
        <p className="text-xl font-bold text-foreground">采购管理</p>
        <p className="mt-1 text-sm text-muted-foreground">移动端采购管理入口</p>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center p-4 pb-6 text-center">
        <Truck className="h-16 w-16 text-muted-foreground" />
        <p className="mt-6 text-lg font-medium text-foreground">功能建设中</p>
        <p className="mt-2 text-sm text-muted-foreground">采购申请、询价、到货验收等功能即将上线</p>
        {onBack && (
          <button
            className="mt-8 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground active:opacity-90"
            onClick={onBack}
          >
            返回首页
          </button>
        )}
      </div>
    </div>
  );
}
