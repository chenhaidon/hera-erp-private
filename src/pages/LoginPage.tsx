import { useState } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Factory } from "lucide-react";
import { recordLoginLog, detectAbnormalLogin } from "@/lib/log";

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username || !password) {
      toast.error("请输入用户名和密码");
      return;
    }
    if (!agreed) {
      toast.error("请同意用户协议与隐私政策");
      return;
    }
    setLoading(true);
    const { error } = await signIn(username, password);
    setLoading(false);
    if (error) {
      toast.error(error.message || "登录失败");
      const { abnormal, reason } = await detectAbnormalLogin(username, "failed");
      await recordLoginLog({
        account: username,
        status: "failed",
        reason: error.message || "账号或密码错误",
        is_abnormal: abnormal,
        abnormal_reason: reason,
      });
      return;
    }
    toast.success("登录成功");
    const { abnormal: successAbnormal, reason: successReason } = await detectAbnormalLogin(username, "success");
    await recordLoginLog({
      account: username,
      status: "success",
      is_abnormal: successAbnormal,
      abnormal_reason: successReason,
    });
    // 同时支持路由 state 和 URL 查询参数中的回跳地址，
    // 扫码入口（设备/报工）都可通过 ?from=... 登录后自动回到对应页面
    const from =
      (location.state as { from?: string })?.from || searchParams.get("from") || "";
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const fallback = isMobile ? "/mobile/home" : "/";
    if (from && from !== "/login" && from !== "/") {
      navigate(from, { replace: true });
    } else {
      navigate(fallback, { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Factory className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">浦江家纺智造管理平台</CardTitle>
          <CardDescription>用户登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
              />
              <Label htmlFor="agree" className="text-sm font-normal">
                我已阅读并同意{" "}
                <Link to="/" className="text-primary hover:underline">
                  用户协议
                </Link>{" "}
                与{" "}
                <Link to="/" className="text-primary hover:underline">
                  隐私政策
                </Link>
              </Label>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link to="/register" className="text-primary hover:underline">
                立即注册
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
