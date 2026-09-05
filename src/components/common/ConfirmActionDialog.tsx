import type { ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, type ButtonProps } from '@/components/ui/button';

export interface ConfirmActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  items?: { label: string; value: ReactNode }[];
  confirmText?: string;
  confirmVariant?: ButtonProps['variant'];
  confirmClassName?: string;
  confirmDisabled?: boolean;
  cancelText?: string;
  onConfirm: () => void;
}

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
  confirmText = '确认',
  confirmVariant = 'default',
  confirmClassName,
  confirmDisabled,
  cancelText = '取消',
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {items && items.length > 0 && (
          <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between gap-4">
                <span className="text-muted-foreground whitespace-nowrap">{item.label}</span>
                <span className="font-medium text-right">{item.value}</span>
              </div>
            ))}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={confirmDisabled}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant={confirmVariant} className={confirmClassName} onClick={onConfirm} disabled={confirmDisabled}>
              {confirmText}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
