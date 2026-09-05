CREATE OR REPLACE FUNCTION gen_finished_quality_records() RETURNS void AS $$
DECLARE
  wo record;
  rec_id uuid;
  record_no text;
  insp_date date;
  hour int;
  minute int;
  time_str text;
  inspector text;
BEGIN
  inspector := '金灵芳';
  FOR wo IN SELECT id, data FROM entity_store WHERE entity_type='work_orders' AND data->>'status' = 'completed'
  LOOP
    IF EXISTS (
      SELECT 1 FROM entity_store
      WHERE entity_type = 'quality_records'
        AND data->>'work_order_id' = wo.id
    ) THEN
      CONTINUE;
    END IF;

    rec_id := gen_random_uuid();
    record_no := 'QC-' || (wo.data->>'work_no');
    insp_date := (wo.data->>'completed_at')::date;
    hour := floor(random() * 8 + 9)::int;   -- 9-16
    minute := floor(random() * 60)::int;
    time_str := lpad(hour::text, 2, '0') || ':' || lpad(minute::text, 2, '0') || ':00';

    INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
    VALUES (
      rec_id,
      'quality_records',
      jsonb_build_object(
        'id', rec_id,
        'record_no', record_no,
        'work_order_id', wo.id,
        'work_order_no', wo.data->>'work_no',
        'contract_no', wo.data->>'contract_no',
        'product_id', wo.data->>'product_id',
        'product_code', wo.data->>'product_code',
        'product_name', wo.data->>'product_name',
        'sku_summary', wo.data->>'sku_summary',
        'color', wo.data->>'color',
        'quantity', (wo.data->>'completed_quantity')::numeric,
        'qualified_qty', (wo.data->>'completed_quantity')::numeric,
        'unqualified_qty', 0,
        'result', 'qualified',
        'inspector', inspector,
        'inspection_date', insp_date::text,
        'inspection_time', (insp_date::text || ' ' || time_str),
        'remark', '工单 ' || (wo.data->>'work_no') || ' 成品质检合格',
        'created_at', now()
      ),
      now(),
      now()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_finished_quality_records();