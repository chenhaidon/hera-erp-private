import { useMemo } from 'react';
import { useAppStore } from '@/store';
import { PRODUCT_CATEGORIES, FABRIC_TYPES, FILLING_TYPES } from '@/lib/data';

export function useProductCategoryOptions() {
  const list = useAppStore((s) => s.productCategories);
  return useMemo(() => {
    const active = list.filter((i) => i.status === 'active');
    return active.length ? active.map((i) => i.name) : PRODUCT_CATEGORIES;
  }, [list]);
}

export function useFabricTypeOptions() {
  const list = useAppStore((s) => s.fabricTypes);
  return useMemo(() => {
    const active = list.filter((i) => i.status === 'active');
    return active.length ? active.map((i) => i.name) : FABRIC_TYPES;
  }, [list]);
}

export function useFillingTypeOptions() {
  const list = useAppStore((s) => s.fillingTypes);
  return useMemo(() => {
    const active = list.filter((i) => i.status === 'active');
    return active.length ? active.map((i) => i.name) : FILLING_TYPES;
  }, [list]);
}
