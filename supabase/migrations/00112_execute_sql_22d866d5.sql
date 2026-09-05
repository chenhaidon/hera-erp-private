BEGIN; DO $$
DECLARE
  v_wo record;
  v_ops jsonb; v_op jsonb; v_new_reports jsonb;
  v_price numeric; v_out_price numeric; v_j int;
  v_workers jsonb;
  v_worker_ids text[] := ARRAY[
    '2d27fcc9-b23c-4da6-8d2f-455bbb55da9f','0ff9a248-2418-42db-92fd-28b2c60de100','cefb9e56-a0b0-4746-a6e5-82c3f50eb051',
    '8626ded5-184b-46cc-8d22-b7851205f9c2','31d595c6-d6cf-4eee-a540-6ea38d03cc59','237b6f20-dded-41c7-9817-762aa1934e26',
    'fff9befe-ba47-4490-b010-1623b76b291f','LNBlSBh_3qKq2PIIft9ju','USicMLjAzaF8wbDPYdIwA'
  ];
  v_names text[] := ARRAY['王建国','张卫国','陈海涛','孙长贵','吴德明','徐宝根','马志强','于娟英','应巧凤'];
  v_qtys int[];
  v_times timestamptz[];
  v_i int; v_wid text; v_wname text; v_qty int; v_t timestamptz;
BEGIN
  FOR v_wo IN
    SELECT id, data->>'work_no' AS work_no FROM entity_store
    WHERE entity_type='work_orders' AND data->>'contract_no'='26JLHD014'
  LOOP
    v_ops := (SELECT data->'operations' FROM entity_store WHERE id=v_wo.id);
    FOR v_j IN 0..jsonb_array_length(v_ops)-1 LOOP
      v_op := v_ops->v_j;
      CONTINUE WHEN v_op->>'code' != 'G-002';
      v_price := COALESCE((v_op->>'price')::numeric,0); v_out_price := COALESCE((v_op->>'out_price')::numeric,0);
      IF v_wo.work_no = 'WO-2026-0016-1' THEN
        v_qtys := ARRAY[18,17,12,13];
        v_times := ARRAY[
          '2026-08-30T22:48:45+08'::timestamptz,
          '2026-09-01T13:52:30+08'::timestamptz,
          '2026-09-05T09:00:00+08'::timestamptz,
          '2026-09-06T10:00:00+08'::timestamptz
        ];
      ELSE
        v_qtys := ARRAY[16,14,11,19];
        v_times := ARRAY[
          '2026-08-30T21:05:48+08'::timestamptz,
          '2026-09-01T08:20:50+08'::timestamptz,
          '2026-09-05T14:00:00+08'::timestamptz,
          '2026-09-06T11:00:00+08'::timestamptz
        ];
      END IF;
      v_new_reports := '[]'::jsonb;
      FOR v_i IN 1..4 LOOP
        v_wid := v_worker_ids[v_i + CASE WHEN v_wo.work_no='WO-2026-0016-1' THEN 0 ELSE 4 END];
        v_wname := v_names[v_i + CASE WHEN v_wo.work_no='WO-2026-0016-1' THEN 0 ELSE 4 END];
        v_qty := v_qtys[v_i];
        v_t := v_times[v_i];
        v_new_reports := v_new_reports || jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边',
          'operator_id', v_wid, 'operator_name', v_wname,
          'qty', v_qty, 'quantity', v_qty,
          'unit_price', COALESCE(NULLIF(v_price,0), v_out_price),
          'amount', round(v_qty * COALESCE(NULLIF(v_price,0), v_out_price), 2),
          'color', v_op->>'color', 'spec', v_op->>'spec', 'remark', '计件报工',
          'report_time', to_char(v_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"HH24:MI:SS"+08:00"'),
          'work_no', v_wo.work_no
        ));
      END LOOP;
      v_op := jsonb_set(v_op, '{reports}', v_new_reports);
      v_ops := jsonb_set(v_ops, ('{'||v_j||'}')::text[], v_op);
    END LOOP;
    UPDATE entity_store SET data = data || jsonb_build_object('operations', v_ops, 'updated_at', now())
    WHERE id=v_wo.id AND entity_type='work_orders';
  END LOOP;
END $$; DO $$
DECLARE
  v_salary jsonb := '{}'::jsonb;
  v_wid text; v_wname text; v_amount numeric;
BEGIN
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
  END LOOP;
END $$; COMMIT;