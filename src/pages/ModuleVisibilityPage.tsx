import { useState, useMemo, useEffect } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store";
import {
  defaultNavItems,
  defaultMenuItems,
  defaultTabItems,
} from "@/lib/navConfig";
import type { ModuleVisibilityConfig } from "@/lib/moduleVisibility";
import {
  saveModuleVisibility,
  loadModuleVisibility,
} from "@/lib/moduleVisibility";
import { Eye, Save, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";

interface ModuleVisibilityPageProps {
  embedded?: boolean;
}

interface ModuleNode {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  menus: { path: string; label: string; roles?: string[] }[];
  tabs: { key: string; label: string }[];
}

export function ModuleVisibilityPage({
  embedded,
}: ModuleVisibilityPageProps = {}) {
  const store = useAppStore();
  const [working, setWorking] = useState<ModuleVisibilityConfig>(
    store.moduleVisibility,
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setWorking(store.moduleVisibility);
  }, [store.moduleVisibility]);

  const modules = useMemo<ModuleNode[]>(() => {
    return defaultNavItems.map((item) => ({
      path: item.path,
      label: item.label,
      icon: item.icon,
      menus: (defaultMenuItems[item.path] ?? []).map((child) => ({
        path: child.path,
        label: child.label,
        roles: child.roles,
      })),
      tabs: defaultTabItems[item.path] ?? defaultTabItems[item.path] ?? [],
    }));
  }, []);

  const filteredModules = useMemo(() => {
    if (!search.trim()) return modules;
    const q = search.trim().toLowerCase();
    return modules
      .map((m) => {
        const matchModule = m.label.toLowerCase().includes(q);
        const matchMenus = m.menus.filter((menu) =>
          menu.label.toLowerCase().includes(q),
        );
        const matchTabs = m.tabs.filter((tab) =>
          tab.label.toLowerCase().includes(q),
        );
        if (matchModule) return m;
        if (matchMenus.length || matchTabs.length) {
          return {
            ...m,
            menus: matchMenus.length ? matchMenus : m.menus,
            tabs: matchTabs.length ? matchTabs : m.tabs,
          };
        }
        return null;
      })
      .filter(Boolean) as ModuleNode[];
  }, [modules, search]);

  const isModuleChecked = (path: string) => working.modules[path] !== false;
  const isMenuChecked = (path: string) => working.menus[path] !== false;
  const isTabChecked = (modulePath: string, key: string) =>
    working.tabs[modulePath]?.[key] !== false;

  const isModuleIndeterminate = (mod: ModuleNode) => {
    const menuCheckedCount = mod.menus.filter((menu) =>
      isMenuChecked(menu.path),
    ).length;
    const tabCheckedCount = mod.tabs.filter((tab) =>
      isTabChecked(mod.path, tab.key),
    ).length;
    const total = mod.menus.length + mod.tabs.length;
    const checked = menuCheckedCount + tabCheckedCount;
    if (total === 0) return false;
    return checked > 0 && checked < total;
  };

  function setAllChildren(mod: ModuleNode, checked: boolean) {
    setWorking((prev) => {
      const next: ModuleVisibilityConfig = {
        modules: { ...prev.modules, [mod.path]: checked },
        menus: { ...prev.menus },
        tabs: { ...prev.tabs },
      };
      for (const menu of mod.menus) {
        next.menus[menu.path] = checked;
      }
      if (!next.tabs[mod.path]) next.tabs[mod.path] = {};
      for (const tab of mod.tabs) {
        next.tabs[mod.path][tab.key] = checked;
      }
      return next;
    });
  }

  function toggleModule(path: string, checked: boolean) {
    const mod = modules.find((m) => m.path === path);
    if (mod) {
      setAllChildren(mod, checked);
    } else {
      setWorking((prev) => ({
        ...prev,
        modules: { ...prev.modules, [path]: checked },
      }));
    }
  }

  function toggleMenu(modulePath: string, menuPath: string, checked: boolean) {
    setWorking((prev) => {
      const next: ModuleVisibilityConfig = {
        modules: { ...prev.modules },
        menus: { ...prev.menus, [menuPath]: checked },
        tabs: { ...prev.tabs },
      };
      const mod = modules.find((m) => m.path === modulePath);
      if (mod) {
        const visibleMenus = mod.menus.filter(
          (menu) => next.menus[menu.path] !== false,
        );
        if (visibleMenus.length === 0 && mod.tabs.length === 0) {
          next.modules[modulePath] = false;
        } else if (visibleMenus.length === mod.menus.length) {
          next.modules[modulePath] = true;
        }
      }
      return next;
    });
  }

  function toggleTab(modulePath: string, key: string, checked: boolean) {
    setWorking((prev) => {
      const next: ModuleVisibilityConfig = {
        modules: { ...prev.modules },
        menus: { ...prev.menus },
        tabs: {
          ...prev.tabs,
          [modulePath]: { ...(prev.tabs[modulePath] || {}), [key]: checked },
        },
      };
      const mod = modules.find((m) => m.path === modulePath);
      if (mod) {
        const visibleTabs = mod.tabs.filter(
          (tab) => next.tabs[modulePath]?.[tab.key] !== false,
        );
        const visibleMenus = mod.menus.filter(
          (menu) => next.menus[menu.path] !== false,
        );
        if (visibleTabs.length === 0 && visibleMenus.length === 0) {
          next.modules[modulePath] = false;
        } else if (
          visibleTabs.length === mod.tabs.length &&
          visibleMenus.length === mod.menus.length
        ) {
          next.modules[modulePath] = true;
        }
      }
      return next;
    });
  }

  async function handleSave() {
    setLoading(true);
    try {
      await saveModuleVisibility(working);
      store.setModuleVisibility(working);
      toast.success("配置保存成功");
    } catch (e) {
      console.error(e);
      toast.error("配置保存失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const saved = await loadModuleVisibility();
    setWorking(saved);
    toast.info("配置已重置");
  }

  function selectAll() {
    const next: ModuleVisibilityConfig = { modules: {}, menus: {}, tabs: {} };
    for (const mod of modules) {
      next.modules[mod.path] = true;
      for (const menu of mod.menus) {
        next.menus[menu.path] = true;
      }
      next.tabs[mod.path] = {};
      for (const tab of mod.tabs) {
        next.tabs[mod.path][tab.key] = true;
      }
    }
    setWorking(next);
  }

  function deselectAll() {
    const next: ModuleVisibilityConfig = { modules: {}, menus: {}, tabs: {} };
    for (const mod of modules) {
      if (mod.path === "/") continue;
      next.modules[mod.path] = false;
      for (const menu of mod.menus) {
        next.menus[menu.path] = false;
      }
      next.tabs[mod.path] = {};
      for (const tab of mod.tabs) {
        next.tabs[mod.path][tab.key] = false;
      }
    }
    setWorking(next);
  }

  if (store.currentRole !== "admin") {
    return (
      <div className="space-y-4">
        {!embedded && (
          <PageHeader
            title="模块可见性管理"
            description="配置系统模块及二级菜单的显示/隐藏状态"
          />
        )}
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            仅管理员可访问模块可见性管理。
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="模块可见性管理"
          description="配置系统模块、二级菜单及页面顶部 Tab 的显示/隐藏状态"
        />
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              模块可见性配置
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索模块/菜单/Tab"
                  className="pl-8 w-48"
                />
              </div>
              <Button variant="outline" size="sm" onClick={selectAll}>
                全选
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                全不选
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={loading}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                重置
              </Button>
              <Button size="sm" onClick={handleSave} disabled={loading}>
                <Save className="mr-1 h-3 w-3" />
                保存
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b border-border bg-muted px-4 py-2 text-xs font-medium text-muted-foreground">
            模块 / 二级菜单 / 页面 Tab
          </div>
          <div className="divide-y divide-border">
            {filteredModules.map((module) => {
              const Icon = module.icon;
              const moduleChecked = isModuleChecked(module.path);
              const indeterminate = isModuleIndeterminate(module);
              const disabled = module.path === "/";
              const moduleDisabled = moduleChecked === false;
              return (
                <div key={module.path} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={`mod-${module.path}`}
                      checked={indeterminate ? "indeterminate" : moduleChecked}
                      disabled={disabled}
                      onCheckedChange={(v) =>
                        toggleModule(module.path, v === true)
                      }
                    />
                    <Label
                      htmlFor={`mod-${module.path}`}
                      className="flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {module.label}
                    </Label>
                  </div>
                  {module.menus.length > 0 && (
                    <div className="ml-8 mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {module.menus.map((menu) => (
                        <div
                          key={menu.path}
                          className="flex items-center gap-2 rounded-md border border-border p-2"
                        >
                          <Checkbox
                            id={`menu-${menu.path}`}
                            checked={isMenuChecked(menu.path)}
                            disabled={moduleDisabled}
                            onCheckedChange={(v) =>
                              toggleMenu(module.path, menu.path, v === true)
                            }
                          />
                          <Label
                            htmlFor={`menu-${menu.path}`}
                            className="text-sm cursor-pointer"
                          >
                            {menu.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                  {module.tabs.length > 0 && (
                    <div className="ml-8 mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {module.tabs.map((tab) => (
                        <div
                          key={tab.key}
                          className="flex items-center gap-2 rounded-md border border-border p-2"
                        >
                          <Checkbox
                            id={`tab-${module.path}-${tab.key}`}
                            checked={isTabChecked(module.path, tab.key)}
                            disabled={moduleDisabled}
                            onCheckedChange={(v) =>
                              toggleTab(module.path, tab.key, v === true)
                            }
                          />
                          <Label
                            htmlFor={`tab-${module.path}-${tab.key}`}
                            className="text-sm cursor-pointer"
                          >
                            {tab.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredModules.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                无匹配结果
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
