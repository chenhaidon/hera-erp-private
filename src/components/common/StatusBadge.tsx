import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  options: { value: string; label: string; color?: string }[];
}

export function StatusBadge({ status, options }: StatusBadgeProps) {
  const matched = options.find((o) => o.value === status);
  const label = matched?.label || status;
  const colorClass = matched?.color || 'bg-gray-500';
  return (
    <Badge className={cn('text-white hover:opacity-90', colorClass)}>
      {label}
    </Badge>
  );
}
