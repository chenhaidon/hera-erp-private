
-- 删除错误关联 PL 的历史领料单
DELETE FROM entity_store
WHERE entity_type = 'material_requisitions' AND data->>'code' = 'MR-2026-0012';

-- 将 PL-2026-3250 两张拆分工单置为待领料状态
UPDATE entity_store
SET data = jsonb_set(data, '{picking_status}', '"pending"')
WHERE entity_type = 'work_orders'
  AND data->>'plan_id' = 'c325ngakjr2v'
  AND data->>'work_no' IN ('WO-2026-0013-1', 'WO-2026-0013-2');
