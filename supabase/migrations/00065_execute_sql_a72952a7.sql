CREATE OR REPLACE FUNCTION gen_processing_payments_all_operations() RETURNS void AS $$
DECLARE
  rec record;
  pid uuid;
BEGIN
  -- 清除旧加工费记录
  DELETE FROM entity_store WHERE entity_type = 'outsource_processing_payments';

  FOR rec IN
    WITH reports AS (
      SELECT
        (wo.data->>'contract_no')::text AS contract_no,
        wo.id AS work_id,
        wo.data->>'work_no' AS work_no,
        wo.data->>'product_code' AS product_code,
        wo.data->>'product_name' AS product_name,
        (r.value->>'operator_id')::text AS operator_id,
        (r.value->>'operator_name')::text AS operator_name,
        (r.value->>'qty')::numeric AS qty,
        (r.value->>'amount')::numeric AS amount,
        (r.value->>'report_time')::text AS report_time
      FROM entity_store wo
      CROSS JOIN LATERAL jsonb_array_elements(wo.data->'operations') AS op
      CROSS JOIN LATERAL jsonb_array_elements(op.value->'reports') AS r
      WHERE wo.entity_type = 'work_orders'
    )
    SELECT
      contract_no,
      operator_id,
      operator_name,
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'work_id', work_id,
          'work_no', work_no,
          'product_code', product_code,
          'product_name', product_name,
          'qty', qty,
          'amount', amount,
          'report_time', report_time
        )
      ), '[]'::jsonb) AS items
    FROM reports
    GROUP BY contract_no, operator_id, operator_name
    ORDER BY contract_no, operator_name
  LOOP
    pid := gen_random_uuid();
    INSERT INTO entity_store (id, entity_type, data, created_at, updated_at)
    VALUES (
      pid,
      'outsource_processing_payments',
      jsonb_build_object(
        'id', pid,
        'payment_no', 'OP-' || rec.contract_no || '-' || rec.operator_name,
        'work_order_id', '',
        'work_order_no', '多工单合并',
        'operation_code', '',
        'operation_name', '多工序合并',
        'product_code', (rec.items->0->>'product_code'),
        'product_name', (rec.items->0->>'product_name'),
        'product_spec', '',
        'product_color', '',
        'factory_id', rec.operator_id,
        'factory_name', rec.operator_name,
        'quantity', (SELECT COALESCE(SUM((x->>'qty')::numeric), 0) FROM jsonb_array_elements(rec.items) AS x),
        'unit_price', 0,
        'amount', (SELECT COALESCE(SUM((x->>'amount')::numeric), 0) FROM jsonb_array_elements(rec.items) AS x),
        'status', 'confirmed',
        'remark', '由报工记录按合同和人员合并生成',
        'contract_no', rec.contract_no,
        'created_at', (SELECT MAX(x->>'report_time') FROM jsonb_array_elements(rec.items) AS x),
        'updated_at', (SELECT MAX(x->>'report_time') FROM jsonb_array_elements(rec.items) AS x)
      ),
      now(),
      now()
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql; DROP FUNCTION IF EXISTS gen_processing_payments_all_operations();