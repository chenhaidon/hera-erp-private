
-- 将 PL-2026-3250 两张工单恢复为待领料状态
UPDATE entity_store
SET data = jsonb_set(data, '{picking_status}', '"pending"')
WHERE entity_type = 'work_orders'
  AND data->>'work_no' IN ('WO-2026-0013-1', 'WO-2026-0013-2');

-- 删除此前模拟生成的错误出库记录
DELETE FROM entity_store
WHERE entity_type = 'stock_records'
  AND data->>'record_no' IN (
    'MO-0013-1-wl0001-White',
    'MO-0013-1-JL003',
    'MO-0013-1-wl0002',
    'MO-0013-1-wl0004',
    'MO-0013-2-wl0001-White',
    'MO-0013-2-JL003',
    'MO-0013-2-wl0002',
    'MO-0013-2-wl0004'
  );

-- 恢复面料仓库存
UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb(10428))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'mat-white-1';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb(9614))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'mat-jl-003';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb(1144))
WHERE entity_type = 'inventory' AND data->>'material_id' = '8s0l6i7mjdwc';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb(13397))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'm7xjlqzp3s2r';
