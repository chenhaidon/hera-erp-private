CREATE OR REPLACE FUNCTION gen_finished_inspections() RETURNS void AS $$
DECLARE
  wo record;
  rec_id uuid;
  code text;
  batch text;
  idx int;
  per_contract_idx jsonb := '{}'::jsonb;
  insp_date date;
  hour int;
  minute int;
  time_str text;
  iso_str text;
  qty numeric;
  items jsonb;
  contract text;
BEGIN
  -- 删除之前生成的未显示 quality_records，避免冗余
  DELETE FROM entity_store WHERE entity_type = 'quality_records';

  FOR wo IN SELECT id, data FROM entity_store WHERE entity_type='work_orders' AND data->>'status' = 'completed'
  LOOP
    IF EXISTS (
      SELECT 1 FROM entity_store
      WHERE entity_type = 'finished_inspections'
        AND data->>'work_no' = wo.data->>'work_no'
    ) THEN
      CONTINUE;
    END IF;

    contract := wo.data->>'contract_no';
    idx := COALESCE((per_contract_idx->>contract)::int, 0) + 1;
    per_contract_idx := jsonb_set(per_contract_idx, ('{' || contract || '}')::text[], to_jsonb(idx), true);

    rec_id := gen_random_uuid();
    code := 'FI-' || contract || '-' || lpad(idx::text, 3, '0');
    batch := 'FB-' || contract || '-' || lpad(idx::text, 3, '0');
    qty := (wo.data->>'completed_quantity')::numeric;
    insp_date := (wo.data->>'completed_at')::date;
    hour := floor(random() * 8 + 9)::int;
    minute := floor(random() * 60)::int;
    time_str := lpad(hour::text, 2, '0') || ':' || lpad(minute::text, 2, '0') || ':00';
    iso_str := insp_date::text || 'T' || time_str || 'Z';

    items := jsonb_build_array(
      jsonb_build_object('name', '外观质量', 'unit', '级', 'standard', 4, 'lower', 3, 'upper', 5, 'actual', 4.5, 'result', 'qualified', 'category', 'appearance'),
      jsonb_build_object('name', '尺寸偏差', 'unit', '%', 'standard', 2, 'lower', 0, 'upper', 3, 'actual', 1.2, 'result', 'qualified', 'category', 'physical'),
      jsonb_build_object('name', '缝制牢度', 'unit', 'N', 'standard', 100, 'lower', 80, 'upper', 150, 'actual', 120, 'result', 'qualified', 'category', 'physical'),
      jsonb_build_object('name', '填充物质量', 'unit', '级', 'standard', 4, 'lower', 3, 'upper', 5, 'actual', 4.5, 'result', 'qualified', 'category', 'physical')
    );

    INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
    VALUES (
      rec_id,
      'finished_inspections',
      jsonb_build_object(
        'id', rec_id,
        'code', code,
        'batch', batch,
        'color', wo.data->>'color',
        'items', items,
        'result', 'qualified',
        'status', 'inspected',
        'work_id', wo.id,
        'work_no', wo.data->>'work_no',
        'check_qty', qty,
        'qualified_qty', qty,
        'unqualified_qty', 0,
        'inspector', '系统管理员',
        'created_at', iso_str,
        'product_id', wo.data->>'product_id',
        'contract_no', contract,
        'product_code', wo.data->>'product_code',
        'product_name', wo.data->>'product_name',
        'sku_summary', wo.data->>'sku_summary'
      ),
      now(),
      now()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_finished_inspections();