
-- 生成领料单 MR-2026-0013：关联 WO-2026-0013-1（200x230 白色 1000 件）
INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
VALUES (
  'mr-2026-0013',
  'material_requisitions',
  '{
    "id": "mr-2026-0013",
    "code": "MR-2026-0013",
    "applicant": "计划员",
    "department": "生产部",
    "created_at": "2026-08-03",
    "required_date": "2026-08-06",
    "status": "pending",
    "related_plan_no": "PL-2026-3250",
    "related_work_order_no": "WO-2026-0013-1",
    "items": [
      {"material_id": "mat-white-1", "material_code": "wl0001-White", "material_name": "A#凉感布（白色）", "specification": "", "unit": "米", "required_qty": 2760, "issued_qty": 0},
      {"material_id": "mat-jl-003", "material_code": "JL003", "material_name": "B#涤点塑（白色）", "specification": "", "unit": "米", "required_qty": 2560, "issued_qty": 0},
      {"material_id": "8s0l6i7mjdwc", "material_code": "wl0002", "material_name": "15g无纺", "specification": "", "unit": "米", "required_qty": 194, "issued_qty": 0},
      {"material_id": "m7xjlqzp3s2r", "material_code": "wl0004", "material_name": "20g无纺衬布", "specification": "", "unit": "米", "required_qty": 2560, "issued_qty": 0}
    ]
  }'::jsonb,
  now(),
  now()
);

-- 生成领料单 MR-2026-0014：关联 WO-2026-0013-2（160x210 白色 1000 件）
INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
VALUES (
  'mr-2026-0014',
  'material_requisitions',
  '{
    "id": "mr-2026-0014",
    "code": "MR-2026-0014",
    "applicant": "计划员",
    "department": "生产部",
    "created_at": "2026-08-03",
    "required_date": "2026-08-06",
    "status": "pending",
    "related_plan_no": "PL-2026-3250",
    "related_work_order_no": "WO-2026-0013-2",
    "items": [
      {"material_id": "mat-white-1", "material_code": "wl0001-White", "material_name": "A#凉感布（白色）", "specification": "", "unit": "米", "required_qty": 1980, "issued_qty": 0},
      {"material_id": "mat-jl-003", "material_code": "JL003", "material_name": "B#涤点塑（白色）", "specification": "", "unit": "米", "required_qty": 1810, "issued_qty": 0},
      {"material_id": "8s0l6i7mjdwc", "material_code": "wl0002", "material_name": "15g无纺", "specification": "", "unit": "米", "required_qty": 167, "issued_qty": 0},
      {"material_id": "m7xjlqzp3s2r", "material_code": "wl0004", "material_name": "20g无纺衬布", "specification": "", "unit": "米", "required_qty": 1810, "issued_qty": 0}
    ]
  }'::jsonb,
  now(),
  now()
);

-- 扣减库存：200x230 工单用料
UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 2760))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'mat-white-1';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 2560))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'mat-jl-003';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 194))
WHERE entity_type = 'inventory' AND data->>'material_id' = '8s0l6i7mjdwc';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 2560))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'm7xjlqzp3s2r';

-- 扣减库存：160x210 工单用料
UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 1980))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'mat-white-1';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 1810))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'mat-jl-003';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 167))
WHERE entity_type = 'inventory' AND data->>'material_id' = '8s0l6i7mjdwc';

UPDATE entity_store
SET data = jsonb_set(data, '{quantity}', to_jsonb((data->>'quantity')::numeric - 1810))
WHERE entity_type = 'inventory' AND data->>'material_id' = 'm7xjlqzp3s2r';

-- 标记两张工单为已领料
UPDATE entity_store
SET data = jsonb_set(data, '{picking_status}', '"picked"')
WHERE entity_type = 'work_orders'
  AND data->>'work_no' IN ('WO-2026-0013-1', 'WO-2026-0013-2');

-- 添加出库记录
INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
VALUES
  ('sr-out-0013-1', 'stock_records', '{"id":"sr-out-0013-1","record_no":"MO-0013-1-wl0001-White","type":"out","subtype":"生产领料","material_id":"mat-white-1","quantity":2760,"warehouse":"面料仓","related_order":"WO-2026-0013-1","related_order_id":"wo-2026-0013-1","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now()),
  ('sr-out-0013-2', 'stock_records', '{"id":"sr-out-0013-2","record_no":"MO-0013-1-JL003","type":"out","subtype":"生产领料","material_id":"mat-jl-003","quantity":2560,"warehouse":"面料仓","related_order":"WO-2026-0013-1","related_order_id":"wo-2026-0013-1","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now()),
  ('sr-out-0013-3', 'stock_records', '{"id":"sr-out-0013-3","record_no":"MO-0013-1-wl0002","type":"out","subtype":"生产领料","material_id":"8s0l6i7mjdwc","quantity":194,"warehouse":"面料仓","related_order":"WO-2026-0013-1","related_order_id":"wo-2026-0013-1","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now()),
  ('sr-out-0013-4', 'stock_records', '{"id":"sr-out-0013-4","record_no":"MO-0013-1-wl0004","type":"out","subtype":"生产领料","material_id":"m7xjlqzp3s2r","quantity":2560,"warehouse":"面料仓","related_order":"WO-2026-0013-1","related_order_id":"wo-2026-0013-1","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now()),
  ('sr-out-0014-1', 'stock_records', '{"id":"sr-out-0014-1","record_no":"MO-0013-2-wl0001-White","type":"out","subtype":"生产领料","material_id":"mat-white-1","quantity":1980,"warehouse":"面料仓","related_order":"WO-2026-0013-2","related_order_id":"wo-2026-0013-2","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now()),
  ('sr-out-0014-2', 'stock_records', '{"id":"sr-out-0014-2","record_no":"MO-0013-2-JL003","type":"out","subtype":"生产领料","material_id":"mat-jl-003","quantity":1810,"warehouse":"面料仓","related_order":"WO-2026-0013-2","related_order_id":"wo-2026-0013-2","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now()),
  ('sr-out-0014-3', 'stock_records', '{"id":"sr-out-0014-3","record_no":"MO-0013-2-wl0002","type":"out","subtype":"生产领料","material_id":"8s0l6i7mjdwc","quantity":167,"warehouse":"面料仓","related_order":"WO-2026-0013-2","related_order_id":"wo-2026-0013-2","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now()),
  ('sr-out-0014-4', 'stock_records', '{"id":"sr-out-0014-4","record_no":"MO-0013-2-wl0004","type":"out","subtype":"生产领料","material_id":"m7xjlqzp3s2r","quantity":1810,"warehouse":"面料仓","related_order":"WO-2026-0013-2","related_order_id":"wo-2026-0013-2","handler":"系统自动","record_date":"2026-08-03 07:35"}'::jsonb, now(), now());
