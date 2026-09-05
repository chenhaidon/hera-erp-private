DELETE FROM entity_store WHERE entity_type = 'maintenance_plans';

INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
SELECT
  'mp-' || e.seq AS id,
  'maintenance_plans',
  jsonb_build_object(
    'id', 'mp-' || e.seq,
    'code', 'MP-' || e.seq,
    'equipment_id', e.eq_id,
    'equipment_name', e.eq_name || '（' || e.eq_code || '）',
    'period_type', 'calendar',
    'period', 30,
    'last_date', e.last_date,
    'next_date', e.next_date,
    'content', e.content,
    'status', e.status
  ),
  now(),
  now()
FROM (
  SELECT
    id AS eq_id,
    data->>'code' AS eq_code,
    data->>'name' AS eq_name,
    data->>'category' AS category,
    lpad(split_part(data->>'code', '-', 2), 3, '0') AS seq,
    CASE
      WHEN data->>'name' LIKE '%缝纫机%' THEN '更换机针、清洁旋梭、检查润滑油位'
      WHEN data->>'name' LIKE '%包边机%' THEN '清洁送布牙、调整包边宽度、检查刀片'
      WHEN data->>'name' LIKE '%拷边机%' THEN '清洁切刀、调整线迹、检查压脚'
      WHEN data->>'category' = '裁剪设备' THEN '更换裁刀、校准裁床水平'
      WHEN data->>'category' = '填充设备' THEN '清洁滤网、检查气压系统、补充填充料'
      WHEN data->>'category' = '包装设备' THEN '检查输送带、润滑链条、清洁吸塑模具'
      WHEN data->>'name' LIKE '%储气罐%' THEN '检查压力表、排水排污、安全阀校验'
      WHEN data->>'name' LIKE '%空压机%' THEN '更换空滤、检查油气分离器、排水排污'
      WHEN data->>'name' LIKE '%检针机%' THEN '校准灵敏度、清洁台面、检查光源'
      WHEN data->>'name' LIKE '%升降机%' THEN '检查链条、润滑导轨、限位开关校验'
      WHEN data->>'name' LIKE '%液压车%' THEN '检查液压油、轮子轴承、刹车系统'
      WHEN data->>'name' LIKE '%平板车%' THEN '检查轮子、润滑轴承、刹车装置'
      ELSE '例行清洁、紧固检查、润滑保养'
    END AS content,
    CASE
      WHEN data->>'code' IN ('EQ-001', 'EQ-002') THEN '2026-07-02'
      WHEN data->>'code' = 'EQ-003' THEN '2026-07-31'
      ELSE '2026-08-21'
    END AS last_date,
    CASE
      WHEN data->>'code' IN ('EQ-001', 'EQ-002') THEN '2026-08-01'
      WHEN data->>'code' = 'EQ-003' THEN '2026-08-25'
      ELSE '2026-09-20'
    END AS next_date,
    CASE
      WHEN data->>'code' IN ('EQ-001', 'EQ-002') THEN 'overdue'
      WHEN data->>'code' = 'EQ-003' THEN 'upcoming'
      ELSE 'normal'
    END AS status
  FROM entity_store
  WHERE entity_type = 'equipment'
) e
ORDER BY e.seq;