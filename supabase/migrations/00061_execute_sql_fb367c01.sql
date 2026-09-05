CREATE OR REPLACE FUNCTION sync_plan_work_orders() RETURNS void AS $$
DECLARE
  p record;
  wos jsonb;
  new_plan_id uuid;
BEGIN
  -- 更新每个生产计划的 work_orders 为实际属于该合同的工单
  FOR p IN SELECT id, data FROM entity_store WHERE entity_type='production_plans'
  LOOP
    SELECT COALESCE(jsonb_agg(work_no ORDER BY work_no), '[]'::jsonb)
    INTO wos
    FROM (
      SELECT data->>'work_no' AS work_no
      FROM entity_store
      WHERE entity_type='work_orders'
        AND data->>'contract_no' = p.data->>'contract_no'
    ) t;

    UPDATE entity_store
    SET data = jsonb_set(data, '{work_orders}', wos, true)
    WHERE id = p.id;
  END LOOP;

  -- 更新每个工单的 plan_id 为对应生产计划的 id
  UPDATE entity_store wo
  SET data = jsonb_set(wo.data, '{plan_id}', to_jsonb(p.id))
  FROM entity_store p
  WHERE wo.entity_type = 'work_orders'
    AND p.entity_type = 'production_plans'
    AND p.data->>'contract_no' = wo.data->>'contract_no';
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS sync_plan_work_orders();