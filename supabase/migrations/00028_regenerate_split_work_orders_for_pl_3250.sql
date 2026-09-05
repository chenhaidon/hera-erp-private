
-- 删除旧的聚合工单 WO-2026-0012
DELETE FROM entity_store
WHERE entity_type = 'work_orders' AND data->>'work_no' = 'WO-2026-0012';

-- 插入按 SKU 拆分的第一张工单：200x230 白色 1000 件
INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
VALUES (
  'wo-2026-0013-1',
  'work_orders',
  '{
    "id": "wo-2026-0013-1",
    "work_no": "WO-2026-0013-1",
    "plan_id": "c325ngakjr2v",
    "product_id": "0k6odi6zhvbz",
    "product_code": "SZ98729-2",
    "product_name": "凉感布地垫 - SZ98729-2-white-200x230",
    "product_category": "绗缝被",
    "product_images": [],
    "plan_quantity": 1000,
    "completed_quantity": 0,
    "progress": 0,
    "status": "issued",
    "source": "plan",
    "priority": "medium",
    "start_date": "2026-08-03",
    "end_date": "2026-08-10",
    "issued_at": "2026-08-03 07:30",
    "created_at": "2026-08-03 07:30",
    "sku_id": "w2965t8u939y",
    "sku_summary": "SZ98729-2-white-200x230",
    "picking_status": "unpicked",
    "operations": [
      {"code":"G-001","completed":false,"completed_qty":0,"device":"裁剪机","is_bottleneck":false,"name":"开料","plan_qty":1000,"seq":1,"skill":"裁剪","status":"pending"},
      {"code":"G-008","completed":false,"completed_qty":0,"device":"绣花机","is_bottleneck":false,"name":"电脑绣","plan_qty":1000,"seq":2,"skill":"绣花","status":"pending"},
      {"code":"G-002","completed":false,"completed_qty":0,"device":"剪边机","is_bottleneck":false,"name":"剪边","plan_qty":1000,"seq":3,"skill":"裁剪","status":"pending"},
      {"code":"G-003","completed":false,"completed_qty":0,"device":"包边机","is_bottleneck":false,"name":"包边","plan_qty":1000,"seq":4,"skill":"缝制","status":"pending"},
      {"code":"G-010","completed":false,"completed_qty":0,"device":"水洗机","is_bottleneck":false,"name":"水洗","plan_qty":1000,"seq":5,"skill":"水洗","status":"pending"},
      {"code":"G-004","completed":false,"completed_qty":0,"device":"检验台","is_bottleneck":false,"name":"初检","plan_qty":1000,"seq":6,"skill":"检验","status":"pending"},
      {"code":"G-005","completed":false,"completed_qty":0,"device":"检验台","is_bottleneck":false,"name":"复检","plan_qty":1000,"seq":7,"skill":"检验","status":"pending"},
      {"code":"G-006","completed":false,"completed_qty":0,"device":"平缝机","is_bottleneck":false,"name":"修补","plan_qty":1000,"seq":8,"skill":"缝制","status":"pending"},
      {"code":"G-007","completed":false,"completed_qty":0,"device":"包装线","is_bottleneck":false,"name":"包装","plan_qty":1000,"seq":9,"skill":"包装","status":"pending"}
    ]
  }'::jsonb,
  now(),
  now()
);

-- 插入按 SKU 拆分的第二张工单：160x210 白色 1000 件
INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
VALUES (
  'wo-2026-0013-2',
  'work_orders',
  '{
    "id": "wo-2026-0013-2",
    "work_no": "WO-2026-0013-2",
    "plan_id": "c325ngakjr2v",
    "product_id": "0k6odi6zhvbz",
    "product_code": "SZ98729-2",
    "product_name": "凉感布地垫 - SZ98729-2-white-160x210",
    "product_category": "绗缝被",
    "product_images": [],
    "plan_quantity": 1000,
    "completed_quantity": 0,
    "progress": 0,
    "status": "issued",
    "source": "plan",
    "priority": "medium",
    "start_date": "2026-08-03",
    "end_date": "2026-08-10",
    "issued_at": "2026-08-03 07:30",
    "created_at": "2026-08-03 07:30",
    "sku_id": "tok3qpwcqn3h",
    "sku_summary": "SZ98729-2-white-160x210",
    "picking_status": "unpicked",
    "operations": [
      {"code":"G-001","completed":false,"completed_qty":0,"device":"裁剪机","is_bottleneck":false,"name":"开料","plan_qty":1000,"seq":1,"skill":"裁剪","status":"pending"},
      {"code":"G-008","completed":false,"completed_qty":0,"device":"绣花机","is_bottleneck":false,"name":"电脑绣","plan_qty":1000,"seq":2,"skill":"绣花","status":"pending"},
      {"code":"G-002","completed":false,"completed_qty":0,"device":"剪边机","is_bottleneck":false,"name":"剪边","plan_qty":1000,"seq":3,"skill":"裁剪","status":"pending"},
      {"code":"G-003","completed":false,"completed_qty":0,"device":"包边机","is_bottleneck":false,"name":"包边","plan_qty":1000,"seq":4,"skill":"缝制","status":"pending"},
      {"code":"G-010","completed":false,"completed_qty":0,"device":"水洗机","is_bottleneck":false,"name":"水洗","plan_qty":1000,"seq":5,"skill":"水洗","status":"pending"},
      {"code":"G-004","completed":false,"completed_qty":0,"device":"检验台","is_bottleneck":false,"name":"初检","plan_qty":1000,"seq":6,"skill":"检验","status":"pending"},
      {"code":"G-005","completed":false,"completed_qty":0,"device":"检验台","is_bottleneck":false,"name":"复检","plan_qty":1000,"seq":7,"skill":"检验","status":"pending"},
      {"code":"G-006","completed":false,"completed_qty":0,"device":"平缝机","is_bottleneck":false,"name":"修补","plan_qty":1000,"seq":8,"skill":"缝制","status":"pending"},
      {"code":"G-007","completed":false,"completed_qty":0,"device":"包装线","is_bottleneck":false,"name":"包装","plan_qty":1000,"seq":9,"skill":"包装","status":"pending"}
    ]
  }'::jsonb,
  now(),
  now()
);

-- 更新主生产计划：补充 SKU 明细并关联新工单
UPDATE entity_store
SET data = jsonb_set(
  jsonb_set(
    data,
    '{sku_items}',
    '[
      {"sku_id":"w2965t8u939y","sku_summary":"SZ98729-2-white-200x230","product_id":"0k6odi6zhvbz","product_code":"SZ98729-2","product_name":"凉感布地垫","quantity":1000,"unit":"件","source_order_ids":["yl0cnze1bm6o"],"source_order_nos":["SO-2026-0012"]},
      {"sku_id":"tok3qpwcqn3h","sku_summary":"SZ98729-2-white-160x210","product_id":"0k6odi6zhvbz","product_code":"SZ98729-2","product_name":"凉感布地垫","quantity":1000,"unit":"件","source_order_ids":["yl0cnze1bm6o"],"source_order_nos":["SO-2026-0012"]}
    ]'::jsonb
  ),
  '{work_orders}',
  '["WO-2026-0013-1","WO-2026-0013-2"]'::jsonb
)
WHERE entity_type = 'production_plans' AND data->>'plan_no' = 'PL-2026-3250';
