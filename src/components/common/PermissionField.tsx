import { cn } from '@/lib/utils';
import { type AppRole, type ResourceRules, canRead, canWrite, isVisible } from '@/lib/permissions';

interface PermissionFieldProps {
  resource: ResourceRules;
  field: string;
  role: AppRole;
  label?: React.ReactNode;
  readOnlyDisplay?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function PermissionField({ resource, field, role, label, readOnlyDisplay, children, className }: PermissionFieldProps) {
  const visible = isVisible(resource, field, role);
  const write = canWrite(resource, field, role);
  const read = canRead(resource, field, role);

  if (!visible) return null;

  return (
    <div className={cn('grid gap-2', className)}>
      {label && <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>}
      {write ? (
        children
      ) : read ? (
        <div className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground min-h-[2.25rem] flex items-center">
          {readOnlyDisplay ?? <span className="text-muted-foreground">-</span>}
        </div>
      ) : null}
    </div>
  );
}
