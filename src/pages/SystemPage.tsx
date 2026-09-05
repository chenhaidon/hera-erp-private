import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ControlledTabs } from "@/components/common/ControlledTabs";
import { useAppStore } from "@/store";
import { SiteSettingsPage } from "@/pages/SiteSettingsPage";
import { WechatMiniProgramSettingsPage } from "@/pages/WechatMiniProgramSettingsPage";
import { UserManagePage } from "@/pages/UserManagePage";
import { PermissionConfigPage } from "@/pages/PermissionConfigPage";
import { OperationLogPage } from "@/pages/OperationLogPage";
import { LoginLogPage } from "@/pages/LoginLogPage";
import { ModuleVisibilityPage } from "@/pages/ModuleVisibilityPage";
import { Settings, Bell, Shield, UserCog, Eye } from "lucide-react";

const roles = [
  { value: "admin", label: "管理员" },
  { value: "production", label: "生产主管" },
  { value: "worker", label: "生产人员" },
  { value: "quality", label: "质检员" },
  { value: "warehouse", label: "仓库管理员" },
  { value: "finance", label: "财务人员" },
  { value: "sales", label: "销售" },
];

export function SystemPage() {
  const store = useAppStore();

  return (
    <div className="space-y-4">
      <PageHeader
        title="系统管理"
        description="平台基础设置、用户权限与日志审计"
      />
      <ControlledTabs modulePath="/system" defaultTab="basic">
        <TabsList className="bg-muted">
          <TabsTrigger value="basic">基础设置</TabsTrigger>
          <TabsTrigger value="site">站点配置</TabsTrigger>
          <TabsTrigger value="wechat-miniapp">小程序配置</TabsTrigger>
          <TabsTrigger value="users">用户管理</TabsTrigger>
          <TabsTrigger value="permissions">权限配置</TabsTrigger>
          <TabsTrigger value="modules">模块可见性</TabsTrigger>
          <TabsTrigger value="operation">操作日志</TabsTrigger>
          <TabsTrigger value="login">登录日志</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-primary" />
                  当前角色
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>切换角色</Label>
                  <Select
                    value={store.currentRole}
                    onValueChange={(v) =>
                      store.setCurrentRole(v as typeof store.currentRole)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  切换后侧边栏将按角色权限显示菜单。
                </p>
              </CardContent>
            </Card>

            <Card>
              <form onSubmit={(e) => e.preventDefault()}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4 text-primary" />
                    基础设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>企业名称</Label>
                    <Input defaultValue="浦江家纺有限公司" />
                  </div>
                  <div className="grid gap-2">
                    <Label>默认币种</Label>
                    <Input defaultValue="CNY" />
                  </div>
                  <Button type="submit">保存设置</Button>
                </CardContent>
              </form>
            </Card>

            <Card>
              <form onSubmit={(e) => e.preventDefault()}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    消息通知
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>预警通知邮箱</Label>
                    <Input type="email" placeholder="admin@example.com" />
                  </div>
                  <Button type="submit">保存通知配置</Button>
                </CardContent>
              </form>
            </Card>

            <Card>
              <form onSubmit={(e) => e.preventDefault()}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    安全设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2">
                    <Label>会话超时（分钟）</Label>
                    <Input type="number" defaultValue={30} />
                  </div>
                  <Button type="submit">保存安全策略</Button>
                </CardContent>
              </form>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="site" className="space-y-4">
          <SiteSettingsPage embedded />
        </TabsContent>

        <TabsContent value="wechat-miniapp" className="space-y-4">
          <WechatMiniProgramSettingsPage embedded />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagePage embedded />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionConfigPage embedded />
        </TabsContent>

        <TabsContent value="modules" className="space-y-4">
          <ModuleVisibilityPage embedded />
        </TabsContent>

        <TabsContent value="operation" className="space-y-4">
          <OperationLogPage embedded />
        </TabsContent>

        <TabsContent value="login" className="space-y-4">
          <LoginLogPage embedded />
        </TabsContent>
      </ControlledTabs>
    </div>
  );
}
