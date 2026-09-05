CREATE OR REPLACE FUNCTION gen_outsource_processing_payments_from_reports() RETURNS void AS $$
DECLARE
  wo record;
  op record;
  r record;
  pid uuid;
  seq int;
BEGIN
  -- 清除旧外协加工费记录
  DELETE FROM entity_store WHERE entity_type = 'outsource_processing_payments';

  FOR wo IN SELECT id, data FROM entity_store WHERE entity_type = 'work_orders'
  LOOP
    seq := 1;
    FOR op IN SELECT value FROM jsonb_array_elements(wo.data->'operations') WHERE value->>'category' = 'outsourcing'
    LOOP
      FOR r IN SELECT value FROM jsonb_array_elements(op.value->'reports')
      LOOP
        pid := gen_random_uuid();
        INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
        VALUES (
          pid,
          'outsource_processing_payments',
          jsonb_build_object(
            'id', pid,
            'payment_no', 'OP-' || (wo.data->>'work_no') || '-' || (op.value->>'code') || '-' || seq,
            'work_order_id', wo.id,
            'work_order_no', wo.data->>'work_no',
            'operation_code', op.value->>'code',
            'operation_name', op.value->>'name',
            'product_code', wo.data->>'product_code',
            'product_name', wo.data->>'product_name',
            'product_spec', r.value->>'spec',
            'product_color', r.value->>'color',
            'factory_id', r.value->>'operator_id',
            'factory_name', r.value->>'operator_name',
            'quantity', (r.value->>'qty')::numeric,
            'unit_price', (r.value->>'unit_price')::numeric,
            'amount', (r.value->>'amount')::numeric,
            'status', 'confirmed',
            'remark', '由报工记录 ' || (r.value->>'id') || ' 生成',
            'contract_no', wo.data->>'contract_no',
            'created_at', r.value->>'report_time',
            'updated_at', r.value->>'report_time'
          ),
          now(),
          now()
        );
        seq := seq + 1;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_outsource_processing_payments_from_reports();