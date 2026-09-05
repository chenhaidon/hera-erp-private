import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface PaymentDialogData {
  amount: number;
  payment_date: string;
  payment_method: string;
  remark: string;
}

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAmount: number;
  /** 订单总额 */
  totalAmount?: number;
  /** 已付金额 */
  paidAmount?: number;
  confirmLabel?: string;
  onConfirm: (data: PaymentDialogData) => void;
}

export function PaymentDialog({
  open,
  onOpenChange,
  defaultAmount,
  totalAmount,
  paidAmount = 0,
  confirmLabel = "确认付款",
  onConfirm,
}: PaymentDialogProps) {
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0],
  );
  const [method, setMethod] = useState<string>("银行转账");
  const [remark, setRemark] = useState<string>("");

  const remaining =
    totalAmount != null ? Math.max(0, totalAmount - paidAmount) : null;

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setPaymentDate(new Date().toISOString().split("T")[0]);
      setMethod("银行转账");
      setRemark("");
    }
  }, [open, defaultAmount]);

  function handleConfirm() {
    if (!amount || amount <= 0) return;
    onConfirm({ amount, payment_date: paymentDate, payment_method: method, remark });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle>确认付款</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {remaining != null && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">订单总额</span>
                <span className="font-medium">
                  ¥{totalAmount!.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">已付金额</span>
                <span className="font-medium text-green-600">
                  ¥{paidAmount.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-1">
                <span className="text-muted-foreground">未付金额</span>
                <span className="font-semibold text-destructive">
                  ¥{remaining.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
          <div className="grid gap-2">
            <Label>付款金额</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0}
            />
          </div>
          <div className="grid gap-2">
            <Label>付款日期</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>付款方式</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="银行转账">银行转账</SelectItem>
                <SelectItem value="现金">现金</SelectItem>
                <SelectItem value="支票">支票</SelectItem>
                <SelectItem value="微信">微信</SelectItem>
                <SelectItem value="支付宝">支付宝</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>备注</Label>
            <Textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="选填..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={!amount || amount <= 0}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}