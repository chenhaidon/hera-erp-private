// 浦江家纺智造管理平台 - 统一 DB 持久化层
// 所有业务实体通过 entity_store（id + entity_type + data jsonb）实现增删改查
import { supabase } from '@/db/supabase';

export interface EntityConfig {
  /** Zustand 状态字段名 */
  field: string;
  /** entity_store 中的实体类型标识 */
  entityType: string;
  /** 设置数组的 action 名 */
  setAction: string;
  /** 新增的 action 名 */
  addAction: string;
  /** 更新的 action 名 */
  updateAction: string;
  /** 删除的 action 名；为空表示该实体暂不提供删除入口 */
  deleteAction?: string;
}

export type AppStateSetter = (
  partial: Record<string, unknown> | ((state: Record<string, unknown>) => Record<string, unknown>)
) => void;

/** 查询指定类型的所有实体 */
export async function fetchEntities(entityType: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('entity_store')
    .select('id, data')
    .eq('entity_type', entityType)
    .order('created_at', { ascending: false })
    .limit(10000);
  if (error) {
    console.warn('[db] fetchEntities', entityType, error.message);
    return [];
  }
  return (data || []).map((row) => {
    const item = (row.data || {}) as Record<string, unknown>;
    return { ...item, id: (item.id as string) || row.id };
  });
}

/** 插入单个实体 */
export async function insertEntity(entityType: string, item: Record<string, unknown>) {
  const id = String(item.id || crypto.randomUUID());
  const data = { ...item, id };
  const { error } = await supabase.from('entity_store').insert({
    id,
    entity_type: entityType,
    data,
  });
  if (error) {
    console.error('[db] insertEntity', entityType, error.message);
    throw error;
  }
  return { id };
}

/** 更新单个实体；如果记录不存在则自动插入，避免静默失败 */
export async function updateEntity(entityType: string, item: Record<string, unknown>) {
  const id = String(item.id ?? '');
  if (!id) {
    const error = new Error('missing id');
    console.error('[db] updateEntity missing id', entityType);
    throw error;
  }
  const { error } = await supabase
    .from('entity_store')
    .upsert(
      {
        id,
        entity_type: entityType,
        data: item,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,entity_type' }
    );
  if (error) {
    console.error('[db] updateEntity', entityType, error.message);
    throw error;
  }
}

/** 删除单个实体 */
export async function deleteEntity(entityType: string, id: string) {
  const { error } = await supabase
    .from('entity_store')
    .delete()
    .eq('id', id)
    .eq('entity_type', entityType);
  if (error) console.error('[db] deleteEntity', entityType, id, error.message);
  return { error };
}

/** 批量初始化种子数据（仅当该类型为空时写入） */
export async function seedEntities(entityType: string, items: Record<string, unknown>[]) {
  if (!items.length) return;
  const { count, error: countError } = await supabase
    .from('entity_store')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', entityType);
  if (countError) {
    console.warn('[db] seedEntities count', entityType, countError.message);
    return;
  }
  if (count && count > 0) return;
  const rows = items.map((item) => ({
    id: String(item.id ?? crypto.randomUUID()),
    entity_type: entityType,
    data: item,
  }));
  const { error } = await supabase.from('entity_store').insert(rows);
  if (error) console.warn('[db] seedEntities', entityType, error.message);
}

/** 一次性加载全部业务实体 */
export async function fetchAllEntities(): Promise<Record<string, Record<string, unknown>[]>> {
  const result: Record<string, Record<string, unknown>[]> = {};
  const { data: rows, error } = await supabase
    .from('entity_store')
    .select('id, entity_type, data')
    .order('created_at', { ascending: false })
    .limit(100000);
  if (error) {
    console.warn('[db] fetchAllEntities', error.message);
    return result;
  }
  for (const row of rows || []) {
    const type = row.entity_type as string;
    if (!result[type]) result[type] = [];
    const item = (row.data || {}) as Record<string, unknown>;
    result[type].push({ ...item, id: (item.id as string) || row.id });
  }
  return result;
}

interface BaseEntity {
  id: string;
  [key: string]: unknown;
}

/** 生成某个实体的 Zustand 切片（状态 + set/add/update/delete actions） */
export function createDbSlice<T extends BaseEntity>(
  set: AppStateSetter,
  config: EntityConfig
): Record<string, unknown> {
  const { field, entityType, setAction, addAction, updateAction, deleteAction } = config;
  const slice: Record<string, unknown> = {
    [field]: [] as T[],
    [setAction]: (data: T[]) => {
      set({ [field]: data } as Record<string, unknown>);
    },
    [addAction]: async (item: T) => {
      const { id } = await insertEntity(entityType, item as Record<string, unknown>);
      const next = { ...item, id: id || (item as BaseEntity).id } as T;
      set((state) => ({ [field]: [...((state[field] as T[]) || []), next] } as Record<string, unknown>));
    },
    [updateAction]: async (item: T) => {
      await updateEntity(entityType, item as Record<string, unknown>);
      set((state) => ({
        [field]: ((state[field] as T[]) || []).map((i) => (i.id === item.id ? item : i)),
      } as Record<string, unknown>));
    },
  };
  if (deleteAction) {
    slice[deleteAction] = async (id: string) => {
      await deleteEntity(entityType, id);
      set((state) => ({
        [field]: ((state[field] as T[]) || []).filter((i) => i.id !== id),
      } as Record<string, unknown>));
    };
  }
  return slice;
}
