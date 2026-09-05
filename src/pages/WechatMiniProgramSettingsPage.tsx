import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/db/supabase";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface WechatMiniProgramSettingsPageProps {
  embedded?: boolean;
}

const KEY_APP_ID = "wechat_miniapp_appid";
const KEY_SECRET = "wechat_miniapp_secret";

export function WechatMiniProgramSettingsPage({
  embedded,
}: WechatMiniProgramSettingsPageProps = {}) {
  const [appId, setAppId] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", [KEY_APP_ID, KEY_SECRET]);
    if (error) {
      toast.error("读取小程序配置失败");
    } else {
      const map: Record<string, string> = {};
      data?.forEach((item) => {
        if (item.value) map[item.key] = item.value;
      });
      if (map[KEY_APP_ID]) setAppId(map[KEY_APP_ID]);
      if (map[KEY_SECRET]) setSecret(map[KEY_SECRET]);
    }
    setLoading(false);
  }

  async function saveSettings() {
    if (!appId.trim() || !secret.trim()) {
      toast.error("AppID 和 AppSecret 不能为空");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("site_settings").upsert(
      [
        { key: KEY_APP_ID, value: appId.trim() },
        { key: KEY_SECRET, value: secret.trim() },
      ],
      { onConflict: "key" }
    );
    if (error) {
      toast.error("保存失败：" + error.message);
    } else {
      toast.success("小程序配置已保存，约 1 分钟后自动生效");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="小程序配置"
          description="配置微信小程序 AppID 和 AppSecret，用于微信一键登录"
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">微信小程序登录</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载配置中...
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="wechatAppId">AppID</Label>
                <Input
                  id="wechatAppId"
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  placeholder="如：wx1234567890abcdef"
                />
                <p className="text-xs text-muted-foreground">
                  在微信公众平台「开发管理 → 开发设置」中获取。
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wechatSecret">AppSecret</Label>
                <Input
                  id="wechatSecret"
                  type="password"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder="仅保存在服务端，不会回显到前端"
                />
                <p className="text-xs text-muted-foreground">
                  保存后将写入 site_settings，Edge Function 会从中读取并调用微信登录接口。
                </p>
              </div>
              <Button onClick={saveSettings} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存配置
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
