import { useMemo, useState, useEffect } from 'react';
import { fetchEntities, insertEntity, updateEntity } from '@/store/dbActions';
import { useAppStore } from '@/store';
import { defaultNavItems, defaultMenuItems, defaultTabItems } from '@/lib/navConfig';

export interface ModuleVisibilityConfig {
  modules: Record<string, boolean>;
  menus: Record<string, boolean>;
  tabs: Record<string, Record<string, boolean>>;
}

const ENTITY_TYPE = 'module_visibility';
const CONFIG_ID = 'module_visibility_config';

export function getDefaultModuleVisibility(): ModuleVisibilityConfig {
  const modules: Record<string, boolean> = { '/': true };
  const menus: Record<string, boolean> = {};
  const tabs: Record<string, Record<string, boolean>> = {};
  for (const item of defaultNavItems) {
    if (item.path !== '/') {
      modules[item.path] = true;
    }
    const children = defaultMenuItems[item.path] ?? [];
    for (const child of children) {
      menus[child.path] = true;
    }
    const pageTabs = defaultTabItems[item.path] ?? defaultTabItems[item.path];
    if (pageTabs) {
      tabs[item.path] = {};
      for (const tab of pageTabs) {
        tabs[item.path][tab.key] = true;
      }
    }
  }
  // 部分非独立模块（如 /finance/tax-refund）的 Tab 也需要默认开启
  for (const [path, pageTabs] of Object.entries(defaultTabItems)) {
    if (!tabs[path]) tabs[path] = {};
    for (const tab of pageTabs) {
      tabs[path][tab.key] = true;
    }
  }
  return { modules, menus, tabs };
}

export function normalizeConfig(value: unknown): ModuleVisibilityConfig {
  const raw = value as Partial<ModuleVisibilityConfig> | undefined;
  const defaults = getDefaultModuleVisibility();
  const tabs: Record<string, Record<string, boolean>> = {};
  for (const [path, map] of Object.entries(defaults.tabs)) {
    tabs[path] = { ...map, ...(raw?.tabs?.[path] || {}) };
  }
  for (const [path, map] of Object.entries(raw?.tabs || {})) {
    if (!tabs[path]) tabs[path] = { ...map };
  }
  return {
    modules: { ...defaults.modules, ...(raw?.modules || {}) },
    menus: { ...defaults.menus, ...(raw?.menus || {}) },
    tabs,
  };
}

export async function loadModuleVisibility(): Promise<ModuleVisibilityConfig> {
  const rows = await fetchEntities(ENTITY_TYPE);
  const config = rows.find((r) => (r as { id?: string }).id === CONFIG_ID);
  if (config) {
    return normalizeConfig(config);
  }
  return getDefaultModuleVisibility();
}

export async function saveModuleVisibility(config: ModuleVisibilityConfig): Promise<void> {
  const rows = await fetchEntities(ENTITY_TYPE);
  const exists = rows.some((r) => (r as { id?: string }).id === CONFIG_ID);
  const payload = { ...config, id: CONFIG_ID };
  if (exists) {
    await updateEntity(ENTITY_TYPE, payload as Record<string, unknown>);
  } else {
    await insertEntity(ENTITY_TYPE, payload as Record<string, unknown>);
  }
}

export function useVisibleTabKeys(modulePath: string): string[] {
  const { moduleVisibility } = useAppStore();
  return useMemo(() => {
    const map = moduleVisibility?.tabs?.[modulePath] || {};
    const allTabs = defaultTabItems[modulePath] || [];
    return allTabs.filter((t) => map[t.key] !== false).map((t) => t.key);
  }, [moduleVisibility, modulePath]);
}

export function useVisibleTabs(modulePath: string, defaultTab: string) {
  const visibleTabKeys = useVisibleTabKeys(modulePath);
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (visibleTabKeys.length === 0) return;
    if (!visibleTabKeys.includes(activeTab)) {
      setActiveTab(visibleTabKeys[0]);
    }
  }, [visibleTabKeys, activeTab]);

  const isTabVisible = (key: string) => visibleTabKeys.includes(key);

  return { activeTab, setActiveTab, visibleTabKeys, isTabVisible };
}

export function useVisibleTabLabels(modulePath: string): Record<string, string> {
  return useMemo(() => {
    const map: Record<string, string> = {};
    const allTabs = defaultTabItems[modulePath] || [];
    for (const tab of allTabs) {
      map[tab.key] = tab.label;
    }
    return map;
  }, [modulePath]);
}
