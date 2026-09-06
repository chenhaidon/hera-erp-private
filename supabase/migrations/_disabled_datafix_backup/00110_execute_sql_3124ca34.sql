BEGIN; DO $$
DECLARE
  v_salary jsonb := '{}'::jsonb;
  v_wid text; v_wname text; v_amount numeric; v_total numeric := 0;
BEGIN
  -- 汇总 2026-09 报工（G-002/G-003）
  SELECT jsonb_object_agg(s.wid, s.amt) INTO v_salary FROM (
    SELECT r->>'operator_id' AS wid, SUM((r->>'amount')::numeric) AS amt
    FROM entity_store e, jsonb_array_elements(e.data->'operations') o, jsonb_array_elements(o->'reports') r
    WHERE e.entity_type='work_orders' AND e.data->>'contract_no'='26JLHD014'
      AND o->>'code' IN ('G-002','G-003')
      AND r->>'report_time' >= '2026-09-01'
    GROUP BY r->>'operator_id'
  ) s;

  FOR v_wid IN SELECT jsonb_object_keys(v_salary) LOOP
    SELECT data->>'name' INTO v_wname FROM entity_store WHERE entity_type='employees' AND id=v_wid;
    v_amount := (v_salary->>v_wid)::numeric;
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'salary_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'employee_id', v_wid, 'employee_name', COALESCE(v_wname,'未知员工'),
      'month', '2026-09', 'salary_type', 'piecework', 'amount', v_amount, 'paid_amount', 0,
      'status', 'pending', 'record_date', '2026-09-06', 'remark', '计件工资',
      'created_at', '2026-09-06T18:00:00+08:00', 'updated_at', now()
    ));
    v_total := v_total + v_amount;
  END LOOP;

  UPDATE entity_store SET data = data || jsonb_build_object('status','producing','updated_at', now())
  WHERE id='d37d1c82-85a9-443b-96a6-7937a1cebcee' AND entity_type='sales_orders';

  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'finance_records', jsonb_build_object(
    'id', gen_random_uuid()::text, 'type', '应收', 'month', '2026-09', 'amount', 27240, 'paid_amount', 0,
    'status', 'pending', 'currency', 'CNY', 'contract_no', '26JLHD014', 'customer_id', 'FTg9Dd0sOFnVlRKLY9bzZ',
    'counterparty', '青岛帝莱家居用品有限公司', 'record_date', '2026-09-04', 'related_order', 'SO-26JLHD014',
    'related_order_id', 'd37d1c82-85a9-443b-96a6-7937a1cebcee', 'remark', '销售订单 SO-26JLHD014 应收账款',
    'created_at', '2026-09-04T18:00:00+08:00', 'updated_at', now()
  ));
  RAISE NOTICE '26JLHD014 done salary total=%', v_total;
END $$; COMMIT;