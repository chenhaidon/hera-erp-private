// 系统管理 - 权限配置（RBAC 树形权限重构版）
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { useAppStore } from '@/store';
import { toast } from 'sonner';
import {
  Shield, Search, Eye, Save, RotateCcw, ChevronRight, ChevronDown,
  LayoutTemplate, PanelRightOpen, CheckCircle2,
} from 'lucide-react';
import {
  RBAC_MODULES, RBAC_BUTTONS, RBAC_ROLES, ROLE_TEMPLATES,
  DATA_SCOPES, loadRbacConfig, saveRbacConfig, isRoleConfigured,
  type RbacButton, type DataScope, type RbacRoleConfig,
} from '@/lib/rbac';

interface PermissionConfigPageProps {
  embedded?: boolean;
}

/** 按钮中文标签 */
const BUTTON_LABEL: Record<RbacButton, string> = {
  view: '查看', create: '新增', edit: '编辑', delete: '删除', export: '导出', audit: '审批',
};

export function PermissionConfigPage({ embedded }: PermissionConfigPageProps = {}) {
  const store = useAppStore();
  const [selectedRole, setSelectedRole] = useState<string>('production');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  /** 菜单折叠状态（模块级） */
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  /** 展开按钮配置的叶子菜单 */
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  /** 当前选中的菜单（用于数据权限配置） */
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);

  const savedCfg = store.rbacPermissions[selectedRole] ?? { buttons: {}, dataScope: {} };
  /** 工作副本（含未保存修改） */
  const [working, setWorking] = useState<RbacRoleConfig>({ buttons: {}, dataScope: {} });

  // 切换角色 / 远端配置更新时重置工作副本
  useEffect(() => {
    const cfg = store.rbacPermissions[selectedRole];
    setWorking({ buttons: cfg ? JSON.parse(JSON.stringify(cfg.buttons)) : {}, dataScope: cfg ? { ...cfg.dataScope } : {} });
    setSelectedMenu(null);
  }, [selectedRole, store.rbacPermissions]);

  // 首次进入加载远端配置
  useEffect(() => {
    void loadRbacConfig();
  }, []);

  const hasChanges = useMemo(
    () => JSON.stringify(working) !== JSON.stringify(savedCfg),
    [working, savedCfg],
  );

  const isMenuView = useCallback((menuKey: string) =>
    (working.buttons[menuKey] || []).includes('view'), [working]);
  const menuButtons = useCallback((menuKey: string) =>
    working.buttons[menuKey] || [], [working]);

  /** 级联勾选菜单（含按钮权限） */
  function toggleMenuChecked(menuKey: string, checked: boolean) {
    setWorking((prev) => {
      const buttons = { ...prev.buttons };
      if (checked) {
        buttons[menuKey] = ['view'];
      } else {
        delete buttons[menuKey];
        // 清理该菜单数据权限
        const dataScope = { ...prev.dataScope };
        delete dataScope[menuKey];
        return { buttons, dataScope };
      }
      return { ...prev, buttons };
    });
  }

  /** 勾选模块：级联所有子菜单 */
  function toggleModule(moduleKey: string, checked: boolean) {
    const mod = RBAC_MODULES.find((m) => m.key === moduleKey);
    if (!mod) return;
    setWorking((prev) => {
      const buttons = { ...prev.buttons };
      const dataScope = { ...prev.dataScope };
      mod.menus.forEach((m) => {
        if (checked) buttons[m.key] = ['view'];
        else { delete buttons[m.key]; delete dataScope[m.key]; }
      });
      return { buttons, dataScope };
    });
  }

  /** 勾选按钮权限（view 为基础权限，勾选其他自动带上 view；取消 view 连带取消全部） */
  function toggleButton(menuKey: string, button: RbacButton, checked: boolean) {
    setWorking((prev) => {
      const buttons = { ...prev.buttons };
      const cur = buttons[menuKey] || [];
      let next: RbacButton[];
      if (button === 'view') {
        next = checked ? ['view'] : [];
      } else {
        if (checked) next = Array.from(new Set<RbacButton>([...(cur.includes('view') ? cur : (['view'] as RbacButton[])), button]));
        else next = cur.filter((b) => b !== button);
      }
      if (next.length === 0) delete buttons[menuKey];
      else buttons[menuKey] = next;
      if (!(buttons[menuKey] || []).includes('view')) {
        const dataScope = { ...prev.dataScope };
        delete dataScope[menuKey];
        return { buttons, dataScope };
      }
      return { ...prev, buttons };
    });
  }

  /** 设置数据权限范围 */
  function setDataScope(menuKey: string, scope: DataScope) {
    setWorking((prev) => ({
      ...prev,
      dataScope: { ...prev.dataScope, [menuKey]: scope },
    }));
  }

  /** 应用模板：覆盖当前配置 */
  function applyTemplate(tplKey: string) {
    const tpl = ROLE_TEMPLATES.find((t) => t.key === tplKey);
    if (!tpl) return;
    const cfg: RbacRoleConfig = { buttons: {}, dataScope: {} };
    tpl.menus.forEach((menuKey) => { cfg.buttons[menuKey] = [...tpl.buttons]; });
    setWorking(cfg);
    toast.info(`已应用「${tpl.label}」，请点击保存后生效`);
  }

  async function handleSave() {
    const role = RBAC_ROLES.find((r) => r.key === selectedRole);
    setSaving(true);
    const ok = await saveRbacConfig(selectedRole, role?.label || selectedRole, working);
    setSaving(false);
    if (ok) {
      toast.success('权限配置已保存，该角色用户重新登录后生效');
    }
  }

  function handleReset() {
    const cfg = store.rbacPermissions[selectedRole];
    setWorking({ buttons: cfg ? JSON.parse(JSON.stringify(cfg.buttons)) : {}, dataScope: cfg ? { ...cfg.dataScope } : {} });
    toast.info('已恢复为上次保存的配置');
  }

  const filteredModules = useMemo(() => {
    if (!search.trim()) return RBAC_MODULES;
    const q = search.trim();
    return RBAC_MODULES.filter((m) => m.label.includes(q) || m.menus.some((x) => x.label.includes(q)));
  }, [search]);

  /** 预览数据 */
  const previewModules = useMemo(() => {
    return RBAC_MODULES.map((m) => ({
      ...m,
      menus: m.menus.filter((x) => (working.buttons[x.key] || []).includes('view')),
    })).filter((m) => m.menus.length > 0);
  }, [working]);

  if (store.currentRole !== 'admin') {
    return (
      <div className="space-y-4">
        {!embedded && <PageHeader title="权限配置" description="可视化配置各角色对菜单、按钮、数据的访问权限" />}
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            仅管理员可访问权限配置。
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedMenuInfo = selectedMenu
    ? (() => {
        const mod = RBAC_MODULES.find((m) => m.menus.some((x) => x.key === selectedMenu));
        const menu = mod?.menus.find((x) => x.key === selectedMenu);
        return mod && menu ? { mod, menu } : null;
      })()
    : null;

  return (
    <div className="space-y-4">
      {!embedded && <PageHeader title="权限配置" description="基于 RBAC 的角色权限配置：菜单级联勾选、按钮细粒度控制、数据范围隔离" />}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                角色权限配置
              </CardTitle>
              {hasChanges && <Badge variant="secondary" className="text-xs">有未保存修改</Badge>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RBAC_ROLES.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}{isRoleConfigured(store.rbacPermissions, r.key) ? '' : '（未配置）'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <LayoutTemplate className="mr-1 h-3 w-3" />
                    应用模板
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>选择模板一键勾选</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ROLE_TEMPLATES.map((t) => (
                    <DropdownMenuItem key={t.key} onClick={() => applyTemplate(t.key)}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground">{t.desc}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-1 h-3 w-3" />
                预览
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
                <RotateCcw className="mr-1 h-3 w-3" />
                撤销修改
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                <Save className="mr-1 h-3 w-3" />
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs">
            勾选父级模块将自动勾选全部子菜单；点击叶子菜单的「展开配置」可细配按钮权限；查看为基础权限，勾选其他按钮时自动带上。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tree">
            <div className="mb-3 flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="tree">菜单与按钮权限</TabsTrigger>
                <TabsTrigger value="data">数据权限</TabsTrigger>
              </TabsList>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索模块/菜单"
                  className="w-44 pl-8"
                />
              </div>
            </div>

            {/* ============ Tab 1：菜单+按钮权限树 ============ */}
            <TabsContent value="tree" className="mt-0">
              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <span>模块 / 菜单（支持级联勾选与折叠）</span>
                  <span>按钮权限配置</span>
                </div>
                <div className="max-h-[560px] overflow-y-auto">
                  {filteredModules.map((mod) => {
                    const allChecked = mod.menus.every((m) => isMenuView(m.key));
                    const someChecked = mod.menus.some((m) => isMenuView(m.key));
                    const open = !collapsedModules[mod.key];
                    return (
                      <div key={mod.key} className="border-b last:border-b-0">
                        {/* 模块级行 */}
                        <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30">
                          <button
                            type="button"
                            onClick={() => setCollapsedModules((p) => ({ ...p, [mod.key]: !p[mod.key] }))}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                            aria-label={open ? '折叠' : '展开'}
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                          <Checkbox
                            id={`mod-${mod.key}`}
                            checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                            onCheckedChange={(v) => toggleModule(mod.key, v === true)}
                          />
                          <label htmlFor={`mod-${mod.key}`} className="flex-1 cursor-pointer select-none text-sm font-medium">
                            {mod.label}
                          </label>
                          <span className="text-xs text-muted-foreground">
                            {mod.menus.filter((m) => isMenuView(m.key)).length}/{mod.menus.length}
                          </span>
                        </div>
                        {/* 菜单级子树 */}
                        {open && (
                          <div className="ml-10 space-y-0.5 border-l border-border pl-2 pr-2 pb-2">
                            {mod.menus.map((menu) => {
                              const hasView = isMenuView(menu.key);
                              const btns = menuButtons(menu.key);
                              const expanded = !!expandedMenus[menu.key];
                              return (
                                <div key={menu.key} className="rounded">
                                  <div className={`flex items-center gap-2 rounded px-2 py-1.5 ${selectedMenu === menu.key ? 'bg-primary/10' : 'hover:bg-muted/50'}`}>
                                    <Checkbox
                                      id={`menu-${menu.key}`}
                                      checked={hasView}
                                      onCheckedChange={(v) => toggleMenuChecked(menu.key, v === true)}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setSelectedMenu(menu.key)}
                                      className={`flex-1 truncate text-left text-sm ${hasView ? 'text-foreground' : 'text-muted-foreground'}`}
                                    >
                                      {menu.label}
                                    </button>
                                    {btns.length > 1 && (
                                      <span className="hidden text-xs text-muted-foreground md:inline">
                                        {btns.map((b) => BUTTON_LABEL[b]).join(' / ')}
                                      </span>
                                    )}
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 px-2 text-xs text-muted-foreground"
                                      disabled={!hasView}
                                      onClick={() => setExpandedMenus((p) => ({ ...p, [menu.key]: !p[menu.key] }))}
                                    >
                                      <ChevronRight className={`mr-0.5 h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                                      展开配置
                                    </Button>
                                  </div>
                                  {/* 按钮权限二级树 */}
                                  {expanded && hasView && (
                                    <div className="ml-8 mt-1 space-y-1 rounded border bg-muted/20 p-2">
                                      <div className="text-xs text-muted-foreground">该模块按钮操作权限：</div>
                                      <div className="flex flex-wrap gap-3">
                                        {RBAC_BUTTONS.map((b) => {
                                          const isView = b.key === 'view';
                                          return (
                                            <label key={b.key} className={`flex items-center gap-1.5 text-sm ${isView ? 'font-medium' : ''}`} title={b.hint}>
                                              <Checkbox
                                                checked={btns.includes(b.key)}
                                                disabled={isView}
                                                onCheckedChange={(v) => toggleButton(menu.key, b.key, v === true)}
                                              />
                                              {b.label}
                                            </label>
                                          );
                                        })}
                                      </div>
                                      <div className="text-xs text-muted-foreground">查看为基础权限不可取消；勾选其他按钮时自动勾选查看。</div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ============ Tab 2：数据权限 ============ */}
            <TabsContent value="data" className="mt-0">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
                <div className="max-h-[560px] overflow-y-auto rounded-md border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    已授权菜单（点击配置数据范围）
                  </div>
                  {RBAC_MODULES.map((mod) => {
                    const granted = mod.menus.filter((m) => isMenuView(m.key));
                    if (!granted.length) return null;
                    return (
                      <div key={mod.key} className="border-b last:border-b-0">
                        <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{mod.label}</div>
                        {granted.map((menu) => (
                          <button
                            key={menu.key}
                            type="button"
                            onClick={() => setSelectedMenu(menu.key)}
                            className={`flex w-full items-center justify-between px-5 py-2 text-left text-sm transition-colors ${
                              selectedMenu === menu.key ? 'bg-primary/10 font-medium' : 'hover:bg-muted/50'
                            }`}
                          >
                            <span className="flex-1 truncate">{menu.label}</span>
                            <Badge variant="outline" className="ml-2 shrink-0 text-xs">
                              {DATA_SCOPES.find((s) => s.key === (working.dataScope[menu.key] || 'all'))?.label}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {previewModules.length === 0 && (
                    <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                      请先在「菜单与按钮权限」中勾选菜单
                    </div>
                  )}
                </div>
                <div>
                  {selectedMenuInfo ? (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-base">
                          <PanelRightOpen className="h-4 w-4 text-primary" />
                          {selectedMenuInfo.menu.label} · 数据权限
                        </CardTitle>
                        <CardDescription>
                          该角色访问「{selectedMenuInfo.mod.label} → {selectedMenuInfo.menu.label}」时可见的数据范围
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <RadioGroup
                          value={working.dataScope[selectedMenu!] || 'all'}
                          onValueChange={(v) => setDataScope(selectedMenu!, v as DataScope)}
                          className="gap-3"
                        >
                          {DATA_SCOPES.map((s) => (
                            <Label
                              key={s.key}
                              htmlFor={`scope-${s.key}`}
                              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border p-3 font-normal hover:bg-muted/50"
                            >
                              <RadioGroupItem id={`scope-${s.key}`} value={s.key} />
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">{s.label}</span>
                                <span className="text-xs text-muted-foreground">{s.desc}</span>
                              </div>
                            </Label>
                          ))}
                        </RadioGroup>
                        <Separator className="my-4" />
                        <div className="text-xs text-muted-foreground">
                          提示：数据权限按菜单独立配置，未配置时默认为「全部数据」。保存后该角色用户重新登录生效。
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                      从左侧选择一个菜单以配置数据权限
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ============ 权限预览 ============ */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent className="max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-lg">
          <SheetHeader>
            <SheetTitle>权限预览</SheetTitle>
            <SheetDescription>
              {RBAC_ROLES.find((r) => r.key === selectedRole)?.label} · 当前配置（未保存修改也计入预览）
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {previewModules.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                当前未配置任何权限
              </div>
            )}
            {previewModules.map((mod) => (
              <div key={mod.key} className="rounded-md border">
                <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">{mod.label}</div>
                <div className="divide-y">
                  {mod.menus.map((menu) => {
                    const btns = working.buttons[menu.key] || [];
                    const scope = working.dataScope[menu.key] || 'all';
                    return (
                      <div key={menu.key} className="space-y-1.5 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5 text-sm">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <span className="truncate">{menu.label}</span>
                          </span>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {DATA_SCOPES.find((s) => s.key === scope)?.label}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {btns.map((b) => (
                            <Badge key={b} variant={b === 'view' ? 'default' : 'secondary'} className="text-xs">
                              {BUTTON_LABEL[b]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
