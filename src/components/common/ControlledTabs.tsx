import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsContent } from '@/components/ui/tabs';
import { useVisibleTabKeys } from '@/lib/moduleVisibility';

interface ControlledTabsProps {
  modulePath: string;
  defaultTab: string;
  activeTab?: string;
  onActiveTabChange?: (tab: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function ControlledTabs({
  modulePath,
  defaultTab,
  activeTab: activeTabProp,
  onActiveTabChange,
  className,
  children,
}: ControlledTabsProps) {
  const visibleTabKeys = useVisibleTabKeys(modulePath);
  const firstVisibleTab = useMemo(() => visibleTabKeys[0] || defaultTab, [visibleTabKeys, defaultTab]);
  const [internalActiveTab, setInternalActiveTab] = useState(firstVisibleTab);

  useEffect(() => {
    if (activeTabProp === undefined) {
      setInternalActiveTab(defaultTab);
    }
  }, [defaultTab, activeTabProp]);

  const activeTab = activeTabProp !== undefined ? activeTabProp : internalActiveTab;
  const effectiveActiveTab = visibleTabKeys.length === 0 ? activeTab : visibleTabKeys.includes(activeTab) ? activeTab : firstVisibleTab;

  const handleValueChange = React.useCallback(
    (value: string) => {
      if (activeTabProp === undefined) {
        setInternalActiveTab(value);
      }
      onActiveTabChange?.(value);
    },
    [activeTabProp, onActiveTabChange]
  );

  const isTabVisible = (key: string) => visibleTabKeys.includes(key);

  return (
    <Tabs value={effectiveActiveTab} onValueChange={handleValueChange} className={className}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const childEl = child as React.ReactElement<Record<string, unknown>>;
        if (childEl.type === TabsList) {
          const listProps = childEl.props as React.ComponentPropsWithoutRef<typeof TabsList>;
          return (
            <TabsList {...listProps}>
              {React.Children.map(listProps.children as React.ReactNode, (trigger) => {
                if (!React.isValidElement(trigger)) return trigger;
                const triggerProps = trigger.props as { value?: string };
                if (triggerProps.value && !isTabVisible(triggerProps.value)) return null;
                return trigger;
              })}
            </TabsList>
          );
        }
        if (childEl.type === TabsContent) {
          const value = childEl.props.value as string | undefined;
          if (value && !isTabVisible(value)) return null;
        }
        return child;
      })}
    </Tabs>
  );
}
