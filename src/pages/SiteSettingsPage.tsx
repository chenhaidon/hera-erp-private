import { useEffect, useState, useRef } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/db/supabase";
import { toast } from "sonner";
import { Loader2, Upload, ImageIcon } from "lucide-react";

const SETTINGS_BUCKET = "site-assets";

interface SiteSettingsPageProps {
  embedded?: boolean;
}

export function SiteSettingsPage({ embedded }: SiteSettingsPageProps = {}) {
  const [siteName, setSiteName] = useState("浦江家纺智造管理平台");
  const [shortName, setShortName] = useState("家纺智造");
  const [logoUrl, setLogoUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("site_settings")
      .select("key, value");
    if (error) {
      toast.error("读取站点配置失败");
    } else {
      const map: Record<string, string> = {};
      data?.forEach((item) => {
        if (item.value) map[item.key] = item.value;
      });
      if (map.site_name) setSiteName(map.site_name);
      if (map.site_short_name) setShortName(map.site_short_name);
      if (map.site_logo_url) setLogoUrl(map.site_logo_url);
    }
    setLoading(false);
  }

  async function ensureBucket() {
    const { data: bucket } = await supabase.storage.getBucket(SETTINGS_BUCKET);
    if (!bucket) {
      const { error } = await supabase.storage.createBucket(SETTINGS_BUCKET, {
        public: true,
        fileSizeLimit: 1024 * 1024,
        allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      });
      if (error) throw error;
    }
  }

  async function uploadLogo(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("请上传图片文件");
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error("图片大小不能超过 1MB");
      return;
    }
    setSaving(true);
    try {
      await ensureBucket();
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(SETTINGS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage
        .from(SETTINGS_BUCKET)
        .getPublicUrl(path);
      setLogoUrl(publicUrlData.publicUrl);
      toast.success("Logo 上传成功");
    } catch (err: any) {
      toast.error(err.message || "Logo 上传失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    const updates = [
      { key: "site_name", value: siteName },
      { key: "site_short_name", value: shortName },
      { key: "site_logo_url", value: logoUrl },
    ];
    const { error } = await supabase
      .from("site_settings")
      .upsert(updates, { onConflict: "key" });
    if (error) {
      toast.error("保存失败：" + error.message);
    } else {
      toast.success("站点配置已保存");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="站点配置"
          description="设置平台名称、Logo 等基础品牌信息"
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">站点信息</CardTitle>
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
                <Label htmlFor="siteName">站点名称</Label>
                <Input
                  id="siteName"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="浦江家纺智造管理平台"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shortName">简称</Label>
                <Input
                  id="shortName"
                  value={shortName}
                  onChange={(e) => setShortName(e.target.value)}
                  placeholder="家纺智造"
                />
              </div>
              <div className="grid gap-2">
                <Label>站点 Logo</Label>
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-md border">
                    <AvatarImage
                      src={logoUrl}
                      alt="站点 Logo"
                      className="object-contain p-2"
                    />
                    <AvatarFallback className="rounded-md bg-muted">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    上传 Logo
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setLogoUrl("")}
                    >
                      移除
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  建议尺寸 120×40，PNG / JPG / WebP，最大 1MB。
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
