BEGIN; DO $$
DECLARE
  v_workers jsonb; v_qcs text[] := ARRAY['金灵芳','张卫国','方自伟'];
  v_wo record;
  v_ops jsonb; v_op jsonb; v_all jsonb; v_reports jsonb; v_rep jsonb;
  v_j int; v_k int; v_n int; v_remaining int; v_batch int;
  v_start timestamptz; v_end_t timestamptz; v_t timestamptz; v_step interval;
  v_price numeric; v_out_price numeric; v_worker jsonb; v_wid text; v_wname text;
  v_def int; v_qualified int; v_result text; v_reason text; v_pi_code text; v_pi_num int := 600;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'name', data->>'name')) INTO v_workers
  FROM entity_store WHERE entity_type='employees' AND data->>'department'='生产部'
    AND data->>'position' IN ('缝纫工','裁剪工','包装工','整烫工','绗缝工','配料工','锁边工','搬运工','杂工');

  FOR v_wo IN
    SELECT id, data->>'work_no' AS work_no, data->>'product_code' AS product_code, data->>'product_name' AS product_name,
      data->>'sku_summary' AS spec, data->>'color' AS color, data->>'product_id' AS product_id
    FROM entity_store WHERE entity_type='work_orders' AND data->>'contract_no'='26JLHD014'
  LOOP
    v_ops := (SELECT data->'operations' FROM entity_store WHERE id=v_wo.id);
    FOR v_j IN 0..jsonb_array_length(v_ops)-1 LOOP
      v_op := v_ops->v_j;
      CONTINUE WHEN v_op->>'code' NOT IN ('G-001','G-008','G-002','G-003');
      CASE v_op->>'code'
        WHEN 'G-001' THEN v_start := '2026-08-25 08:00:00+08'::timestamptz; v_end_t := '2026-08-27 18:00:00+08'::timestamptz;
        WHEN 'G-008' THEN v_start := '2026-08-28 08:00:00+08'::timestamptz; v_end_t := '2026-08-30 18:00:00+08'::timestamptz;
        WHEN 'G-002' THEN v_start := '2026-08-30 08:00:00+08'::timestamptz; v_end_t := '2026-09-03 18:00:00+08'::timestamptz;
        WHEN 'G-003' THEN v_start := '2026-09-03 08:00:00+08'::timestamptz; v_end_t := '2026-09-06 18:00:00+08'::timestamptz;
      END CASE;
      v_price := COALESCE((v_op->>'price')::numeric,0); v_out_price := COALESCE((v_op->>'out_price')::numeric,0);

      v_remaining := 60; v_all := '[]'::jsonb;
      WHILE v_remaining > 0 LOOP
        v_batch := CASE v_op->>'code' WHEN 'G-008' THEN 15+floor(random()*15)::int WHEN 'G-002' THEN 20+floor(random()*15)::int WHEN 'G-003' THEN 20+floor(random()*20)::int ELSE 15+floor(random()*15)::int END;
        IF v_batch > v_remaining THEN v_batch := v_remaining; END IF;
        v_worker := v_workers->(floor(random()*jsonb_array_length(v_workers))::int);
        v_wid := v_worker->>'id'; v_wname := v_worker->>'name';
        v_all := v_all || jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text, 'operation_code', v_op->>'code', 'operation_name', v_op->>'name',
          'operator_id', v_wid, 'operator_name', v_wname, 'qty', v_batch, 'quantity', v_batch,
          'unit_price', COALESCE(NULLIF(v_price,0), v_out_price),
          'amount', round(v_batch * COALESCE(NULLIF(v_price,0), v_out_price), 2),
          'color', v_wo.color, 'spec', v_wo.spec, 'remark', '计件报工', 'report_time', '', 'work_no', v_wo.work_no
        ));
        v_remaining := v_remaining - v_batch;
      END LOOP;

      v_n := jsonb_array_length(v_all); v_step := (v_end_t - v_start) / GREATEST(v_n,1); v_reports := '[]'::jsonb;
      FOR v_k IN 0..v_n-1 LOOP
        v_t := v_start + v_step * (v_k + 0.3 + random()*0.5);
        IF v_t > v_end_t THEN v_t := v_end_t; END IF;
        v_rep := v_all->v_k;
        v_rep := jsonb_set(v_rep, '{report_time}', to_jsonb(to_char(v_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"HH24:MI:SS"+08:00"')));
        v_reports := v_reports || jsonb_build_array(v_rep);
      END LOOP;
      v_op := jsonb_set(v_op, '{reports}', v_reports);
      IF v_op->>'code' = 'G-003' THEN
        v_op := jsonb_set(v_op, '{status}', '"running"'::jsonb);
        v_op := jsonb_set(v_op, '{completed}', 'false'::jsonb);
      END IF;
      v_ops := jsonb_set(v_ops, ('{'||v_j||'}')::text[], v_op);

      -- 过程检查
      v_pi_num := v_pi_num + 1; v_pi_code := 'PI-26JLHD014-'||LPAD(v_pi_num::text,3,'0');
      v_def := CASE WHEN v_wo.work_no='WO-2026-0016-1' AND v_op->>'code'='G-008' THEN 1 WHEN v_wo.work_no='WO-2026-0016-2' AND v_op->>'code'='G-002' THEN 1 ELSE 0 END;
      v_qualified := 60 - v_def; v_result := CASE WHEN v_def>0 THEN 'partial' ELSE 'qualified' END; v_reason := CASE WHEN v_def>0 THEN '外观轻微瑕疵' ELSE '' END;
      INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections', jsonb_build_object(
        'id', gen_random_uuid()::text, 'code', v_pi_code, 'contract_no', '26JLHD014', 'work_id', v_wo.id, 'work_no', v_wo.work_no,
        'work_order_id', v_wo.id, 'work_order_no', v_wo.work_no, 'operation_code', v_op->>'code', 'operation_name', v_op->>'name',
        'product_code', v_wo.product_code, 'product_name', v_wo.product_name, 'color', v_wo.color, 'check_date', v_end_t::date,
        'check_qty', 60, 'qualified_qty', v_qualified, 'unqualified_qty', v_def,
        'qualified_rate', round(v_qualified::numeric/60*100,2)::text||'%', 'result', v_result, 'status', 'inspected',
        'defect_reason', v_reason, 'inspector', v_qcs[1+floor(random()*3)::int],
        'items', jsonb_build_array(
          jsonb_build_object('id', gen_random_uuid()::text,'category','appearance','name','外观缺陷','standard',0,'lower',0,'upper',1,'actual',0,'unit','处','result','qualified'),
          jsonb_build_object('id', gen_random_uuid()::text,'category','physical','name','尺寸偏差','standard',0,'lower',-2,'upper',2,'actual', CASE WHEN v_def>0 THEN 1 ELSE 0 END,'unit','mm','result','qualified')
        ),
        'created_at', to_char(v_end_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"17:00:00"+08:00"'),
        'updated_at', to_char(v_end_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"17:00:00"+08:00"')
      ));
    END LOOP;
    UPDATE entity_store SET data = data || jsonb_build_object('operations', v_ops, 'updated_at', now()) WHERE id = v_wo.id;
  END LOOP;
END $$; COMMIT;