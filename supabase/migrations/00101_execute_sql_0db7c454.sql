BEGIN; DO $$
DECLARE
  v_workers jsonb;
  v_qcs text[] := ARRAY['金灵芳','张卫国','方自伟'];
  v_wo record;
  v_ops jsonb; v_new_ops jsonb; v_op jsonb;
  v_op_code text; v_op_name text; v_op_cat text; v_op_price numeric; v_op_out_price numeric;
  v_plan int; v_completed int; v_remaining int; v_batch int;
  v_start timestamptz; v_end_t timestamptz; v_step interval; v_t timestamptz;
  v_worker jsonb; v_worker_id text; v_worker_name text;
  v_reports jsonb; v_all jsonb; v_rep jsonb;
  v_sorted jsonb[]; v_n int; v_i int; v_k int;
  v_work_no text; v_wid text; v_spec text; v_color text; v_pid text; v_pcode text; v_pname text;
  v_sku text;
  v_pi_id text; v_pi_code text; v_pi_num int := 500;
  v_def int; v_qualified int; v_result text; v_reason text; v_inspector text;
  v_os_id text; v_or_id text; v_pfp_id text;
  v_os_no text; v_or_no text; v_pfp_code text;
  v_factory_id uuid; v_factory_name text;
  v_phys_wo_id uuid; v_phys_os_id uuid;
  v_inv_id text;
  v_stock_qty int; v_loc_id text;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', e.data->>'id', 'name', e.data->>'name')) INTO v_workers
  FROM entity_store e WHERE e.entity_type='employees' AND e.data->>'department'='生产部'
    AND e.data->>'position' IN ('缝纫工','裁剪工','包装工','整烫工','绗缝工','配料工','锁边工','搬运工','杂工');

  FOR v_wo IN SELECT id, data FROM entity_store WHERE entity_type='work_orders' AND data->>'contract_no'='26JLHD016' ORDER BY data->>'work_no'
  LOOP
    v_wid := v_wo.data->>'id';
    v_work_no := v_wo.data->>'work_no';
    v_plan := COALESCE((v_wo.data->>'plan_quantity')::int,0);
    v_spec := COALESCE(v_wo.data->>'sku_summary','');
    v_color := COALESCE(v_wo.data->>'color','');
    v_pid := v_wo.data->>'product_id';
    v_pcode := v_wo.data->>'product_code';
    v_pname := v_wo.data->>'product_name';
    v_sku := CASE WHEN v_spec ILIKE '98×98%' THEN 'sz26007-qxl' WHEN v_spec ILIKE '108×98%' THEN 'sz26007-kxl' ELSE 'sz26007-ok' END;
    v_ops := v_wo.data->'operations';
    v_new_ops := '[]'::jsonb;

    -- 物理工单表准备
    SELECT id INTO v_phys_wo_id FROM work_orders WHERE work_orders.work_no = v_work_no LIMIT 1;
    IF v_phys_wo_id IS NULL THEN
      INSERT INTO work_orders (work_no, product_code, product_name, plan_quantity, status, source, priority)
      VALUES (v_work_no, v_pcode, v_pname, v_plan, 'running','plan','medium') RETURNING id INTO v_phys_wo_id;
    END IF;

    FOR v_i IN 0 .. jsonb_array_length(v_ops)-1 LOOP
      v_op := v_ops->v_i;
      v_op_code := v_op->>'code';
      v_op_name := v_op->>'name';
      v_op_cat := v_op->>'category';
      v_op_price := CASE v_op_code WHEN 'G-001' THEN 0.5 WHEN 'G-002' THEN 0.3 WHEN 'G-003' THEN 0.6 WHEN 'G-007' THEN 0.3 ELSE 0 END;
      v_op_out_price := CASE v_op_code WHEN 'G-008' THEN 2 WHEN 'G-010' THEN 1 ELSE 0 END;
      v_completed := COALESCE((v_op->>'completed_qty')::int,0);

      -- 只处理到包边(G-003)，后续跳过；包边设为 running，前面工序 completed
      IF v_op_code IN ('G-010','G-011','G-007') THEN
        v_new_ops := v_new_ops || jsonb_build_array(v_op);
        CONTINUE;
      END IF;

      -- 时间窗口（每个工序跨多天，避免同一天同一个工序）
      IF v_work_no = 'WO-2026-0013-1' THEN
        v_start := CASE v_op_code
          WHEN 'G-008' THEN '2026-08-28 08:00:00+08'::timestamptz
          WHEN 'G-002' THEN '2026-09-01 08:00:00+08'::timestamptz
          WHEN 'G-003' THEN '2026-09-04 08:00:00+08'::timestamptz
          ELSE '2026-08-25 08:00:00+08'::timestamptz END;
        v_end_t := CASE v_op_code
          WHEN 'G-008' THEN '2026-08-30 18:00:00+08'::timestamptz
          WHEN 'G-002' THEN '2026-09-03 18:00:00+08'::timestamptz
          WHEN 'G-003' THEN '2026-09-06 18:00:00+08'::timestamptz
          ELSE '2026-08-27 18:00:00+08'::timestamptz END;
      ELSE
        v_start := CASE v_op_code
          WHEN 'G-001' THEN '2026-08-26 08:00:00+08'::timestamptz
          WHEN 'G-008' THEN '2026-08-30 08:00:00+08'::timestamptz
          WHEN 'G-002' THEN '2026-09-03 08:00:00+08'::timestamptz
          WHEN 'G-003' THEN '2026-09-05 08:00:00+08'::timestamptz
          ELSE '2026-08-26 08:00:00+08'::timestamptz END;
        v_end_t := CASE v_op_code
          WHEN 'G-001' THEN '2026-08-29 18:00:00+08'::timestamptz
          WHEN 'G-008' THEN '2026-09-02 18:00:00+08'::timestamptz
          WHEN 'G-002' THEN '2026-09-04 18:00:00+08'::timestamptz
          WHEN 'G-003' THEN '2026-09-06 18:00:00+08'::timestamptz
          ELSE '2026-08-29 18:00:00+08'::timestamptz END;
      END IF;

      -- 报工记录：保留已有，补齐剩余到 plan_quantity
      v_reports := COALESCE(v_op->'reports','[]'::jsonb);
      SELECT array_agg(x ORDER BY (x->>'report_time')::timestamptz) INTO v_sorted FROM jsonb_array_elements(v_reports) AS x;
      v_all := COALESCE(to_jsonb(v_sorted), '[]'::jsonb);
      v_remaining := v_plan - v_completed;

      IF v_remaining > 0 THEN
        WHILE v_remaining > 0 LOOP
          v_batch := CASE v_op_code
            WHEN 'G-008' THEN 80 + floor(random()*50)::int
            WHEN 'G-002' THEN 120 + floor(random()*80)::int
            WHEN 'G-003' THEN 150 + floor(random()*100)::int
            ELSE 80 + floor(random()*60)::int END;
          IF v_batch > v_remaining THEN v_batch := v_remaining; END IF;
          v_worker := v_workers->(floor(random()*jsonb_array_length(v_workers))::int);
          v_worker_id := v_worker->>'id'; v_worker_name := v_worker->>'name';
          v_all := v_all || jsonb_build_array(jsonb_build_object(
            'id', gen_random_uuid()::text, 'operation_code', v_op_code, 'operation_name', v_op_name,
            'operator_id', v_worker_id, 'operator_name', v_worker_name,
            'qty', v_batch, 'quantity', v_batch, 'unit_price', COALESCE(v_op_price, v_op_out_price),
            'amount', round(v_batch*COALESCE(v_op_price, v_op_out_price),2),
            'color', v_color, 'spec', v_spec, 'remark', '计件报工',
            'report_time', to_char(v_start AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"HH24:MI:SS"+08:00"'),
            'work_no', v_work_no
          ));
          v_remaining := v_remaining - v_batch;
        END LOOP;
      END IF;

      v_n := jsonb_array_length(v_all);
      IF v_n > 0 THEN
        v_step := (v_end_t - v_start) / GREATEST(v_n,1);
        v_reports := '[]'::jsonb;
        FOR v_k IN 0 .. v_n-1 LOOP
          v_t := v_start + v_step * (v_k + random()*0.7);
          IF v_t > v_end_t THEN v_t := v_end_t; END IF;
          v_rep := v_all->v_k;
          v_rep := jsonb_set(v_rep, '{report_time}', to_jsonb(to_char(v_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"HH24:MI:SS"+08:00"')));
          v_rep := jsonb_set(v_rep, '{spec}', to_jsonb(v_spec));
          v_reports := v_reports || jsonb_build_array(v_rep);
        END LOOP;
        v_op := jsonb_set(v_op, '{reports}', v_reports);
      END IF;

      -- 工序状态：包边设为 running（不完成），其他到包边之前的设为 completed
      IF v_op_code = 'G-003' THEN
        v_op := jsonb_set(v_op, '{completed_qty}', to_jsonb(v_plan));
        v_op := jsonb_set(v_op, '{status}', '"running"'::jsonb);
        v_op := jsonb_set(v_op, '{completed}', 'false'::jsonb);
      ELSE
        v_op := jsonb_set(v_op, '{completed_qty}', to_jsonb(v_plan));
        v_op := jsonb_set(v_op, '{status}', '"completed"'::jsonb);
        v_op := jsonb_set(v_op, '{completed}', 'true'::jsonb);
      END IF;
      IF COALESCE(v_op->>'pqc_inspection_id','') = '' THEN
        v_op := jsonb_set(v_op, '{pqc_inspection_id}', to_jsonb(gen_random_uuid()::text));
      END IF;

      -- 外协工序：发料单、回货单、加工款应付
      IF v_op_cat = 'outsourcing' AND v_op_code IN ('G-008') THEN
        v_os_id := gen_random_uuid()::text;
        v_or_id := gen_random_uuid()::text;
        v_pfp_id := gen_random_uuid()::text;
        v_os_no := 'OS-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
        v_or_no := 'OR-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
        v_pfp_code := 'PFP-26JLHD016-'||LPAD((floor(random()*900+100))::int::text,3,'0');
        v_def := CASE WHEN v_work_no='WO-2026-0013-1' AND v_op_code='G-008' THEN 1 ELSE 0 END;
        v_qualified := v_plan - v_def;
        v_result := CASE WHEN v_def>0 THEN 'partial' ELSE 'qualified' END;
        v_reason := CASE WHEN v_def>0 THEN '外观轻微瑕疵' ELSE '' END;

        IF v_op_code='G-008' THEN
          SELECT of.id, of.data->>'factory_name' INTO v_factory_id, v_factory_name FROM entity_store of WHERE of.entity_type='outsource_factories' AND of.data->>'processing_capability' ILIKE '%绣花%' ORDER BY random() LIMIT 1;
        END IF;

        -- 发料日期 = 工序最早报工时间前2天，回货日期 = 工序最晚报工时间后1-2天
        INSERT INTO entity_store (id, entity_type, data) VALUES (v_os_id, 'outsource_shipments',
          jsonb_build_object('id', v_os_id, 'shipment_no', v_os_no, 'contract_no','26JLHD016',
            'work_order_id', v_wid, 'work_order_no', v_work_no,
            'operation_code', v_op_code, 'operation_name', v_op_name,
            'product_code', v_pcode, 'product_name', v_pname,
            'factory_id', v_factory_id::text, 'factory_name', v_factory_name,
            'shipment_date', (v_start - interval '2 days')::date, 'shipment_quantity', v_plan, 'status','shipped',
            'items', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,'material_code', v_pcode,'material_name', v_pname,'quantity', v_plan,'shipment_id', v_os_id,'unit','套')),
            'created_at', to_char((v_start - interval '2 days') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"09:00:00"+08:00"'),
            'updated_at', to_char((v_start - interval '2 days') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"09:00:00"+08:00"')));

        INSERT INTO entity_store (id, entity_type, data) VALUES (v_or_id, 'outsource_returns',
          jsonb_build_object('id', v_or_id, 'return_no', v_or_no, 'shipment_no', v_os_no, 'shipment_id', v_os_id,
            'contract_no','26JLHD016','work_order_id', v_wid, 'work_order_no', v_work_no,
            'operation_code', v_op_code, 'operation_name', v_op_name,
            'product_code', v_pcode, 'product_name', v_pname,
            'factory_id', v_factory_id::text, 'factory_name', v_factory_name,
            'return_date', (v_end_t + interval '1 day')::date, 'return_quantity', v_plan, 'qualified_quantity', v_qualified,
            'defective_quantity', v_def,'inspection_status', v_result,'status','returned','return_type','semi_finished',
            'defect_reason', v_reason,'inspector', v_qcs[1 + floor(random()*3)::int],
            'items', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,'material_code', v_pcode,'material_name', v_pname,'quantity', v_plan,'return_id', v_or_id,'unit','套')),
            'created_at', to_char((v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"16:00:00"+08:00"'),
            'updated_at', to_char((v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"16:00:00"+08:00"')));

        INSERT INTO entity_store (id, entity_type, data) VALUES (v_pfp_id, 'processing_fee_payables',
          jsonb_build_object('id', v_pfp_id, 'code', v_pfp_code, 'contract_no','26JLHD016',
            'work_order_id', v_wid, 'work_order_no', v_work_no,
            'operation_code', v_op_code, 'operation_name', v_op_name,
            'factory_name', v_factory_name,
            'quantity', v_plan,'unit_price', v_op_out_price,'total_amount', round(v_plan*v_op_out_price,2),'paid_amount',0,
            'status','pending','remark', v_op_name||'外协加工费',
            'created_at', to_char((v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"16:00:00"+08:00"'),
            'updated_at', to_char((v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"16:00:00"+08:00"')));

        -- 物理表外协记录
        v_phys_os_id := gen_random_uuid();
        INSERT INTO outsource_shipments (id, shipment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, shipment_date, shipment_quantity, logistics_company, logistics_no, status, created_at, updated_at)
        VALUES (v_phys_os_id, v_os_no, v_wid, v_work_no, v_op_code, v_op_name, v_pcode, v_pname, v_factory_id, v_factory_name, (v_start - interval '2 days')::date, v_plan, '安能物流', 'LOG-'||v_os_no, 'shipped', (v_start - interval '2 days') AT TIME ZONE 'Asia/Shanghai', (v_start - interval '2 days') AT TIME ZONE 'Asia/Shanghai');
        INSERT INTO outsource_returns (id, return_no, shipment_no, shipment_id, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, return_date, return_quantity, qualified_quantity, defective_quantity, inspection_status, status, return_type, defect_reason, inspector, created_at, updated_at)
        VALUES (gen_random_uuid(), v_or_no, v_os_no, v_phys_os_id, v_wid, v_work_no, v_op_code, v_op_name, v_pcode, v_pname, v_factory_id, v_factory_name, (v_end_t + interval '1 day')::date, v_plan, v_qualified, v_def, v_result, 'returned','semi_finished', v_reason, v_qcs[1 + floor(random()*3)::int], (v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai', (v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai');
        INSERT INTO outsource_processing_payments (id, payment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, product_spec, product_color, factory_id, factory_name, quantity, unit_price, amount, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_pfp_code, v_phys_wo_id, v_work_no, v_op_code, v_op_name, v_pcode, v_pname, v_spec, v_color, v_factory_id, v_factory_name, v_plan, v_op_out_price, round(v_plan*v_op_out_price,2), 'pending', (v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai', (v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai');

        -- 外协回货库存同步（半成品/在制品入外协仓库或车间暂存，这里用生产领料-外协回货入库体现）
        INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records',
          jsonb_build_object('id', gen_random_uuid()::text, 'record_no','WI-'||floor(random()*900000+100000)::int::text,
            'type','in','subtype','外协回货入库','product_id', v_pid,'product_code', v_pcode,'product_name', v_pname,
            'sku_id', v_sku,'quantity', v_plan,'warehouse','外协仓','handler','仓库管理员',
            'record_date', (v_end_t + interval '1 day')::date,'related_order', v_work_no,'related_order_id', v_wid,
            'remark', v_op_name||'外协回货','created_at', to_char((v_end_t + interval '1 day') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"16:00:00"+08:00"'),
            'contract_no','26JLHD016'));

        v_op := jsonb_set(v_op, '{outsourcing_status}', '"returned"'::jsonb);
        v_op := jsonb_set(v_op, '{dispatch_id}', to_jsonb(v_os_id));
        v_op := jsonb_set(v_op, '{return_qc_id}', to_jsonb(v_or_id));
      END IF;

      -- 过程检查（每个完成/进行中的工序都生成，包边也生成但状态 partial-running）
      IF v_op_code <> 'G-003' OR v_op_code = 'G-003' THEN
        v_pi_num := v_pi_num + 1;
        v_pi_id := gen_random_uuid()::text;
        v_pi_code := 'PI-26JLHD016-'||LPAD(v_pi_num::text,3,'0');
        v_def := CASE
          WHEN v_work_no='WO-2026-0013-1' AND v_op_code='G-008' THEN 1
          WHEN v_work_no='WO-2026-0013-2' AND v_op_code='G-002' THEN 1
          ELSE 0 END;
        v_qualified := v_plan - v_def;
        v_result := CASE WHEN v_def>0 THEN 'partial' ELSE 'qualified' END;
        v_reason := CASE WHEN v_def>0 THEN '外观轻微瑕疵' ELSE '' END;
        v_inspector := v_qcs[1 + floor(random()*3)::int];
        INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections',
          jsonb_build_object('id', v_pi_id, 'code', v_pi_code, 'contract_no','26JLHD016',
            'work_id', v_wid, 'work_no', v_work_no, 'work_order_id', v_wid, 'work_order_no', v_work_no,
            'operation_code', v_op_code, 'operation_name', v_op_name,
            'product_code', v_pcode, 'product_name', v_pname, 'color', v_color,
            'check_date', v_end_t::date, 'check_qty', v_plan, 'qualified_qty', v_qualified, 'unqualified_qty', v_def,
            'qualified_rate', round(v_qualified::numeric/NULLIF(v_plan,0)*100,2)::text||'%',
            'result', v_result, 'status','inspected', 'defect_reason', v_reason, 'inspector', v_inspector,
            'items', jsonb_build_array(
              jsonb_build_object('id', gen_random_uuid()::text,'category','appearance','name','外观缺陷','standard',0,'lower',0,'upper',1,'actual',0,'unit','处','result','qualified'),
              jsonb_build_object('id', gen_random_uuid()::text,'category','physical','name','尺寸偏差','standard',0,'lower',-2,'upper',2,'actual', CASE WHEN v_def>0 THEN 1 ELSE 0 END,'unit','mm','result','qualified')),
            'created_at', to_char(v_end_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"17:00:00"+08:00"'),
            'updated_at', to_char(v_end_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"17:00:00"+08:00"')));
      END IF;

      v_new_ops := v_new_ops || jsonb_build_array(v_op);
    END LOOP;

    -- 工单状态更新：WO-1 running, WO-2 running；progress 计算到包边工序
    UPDATE entity_store SET data = data || jsonb_build_object(
      'status','running','progress', CASE WHEN v_work_no='WO-2026-0013-1' THEN 57 ELSE 57 END,
      'completed_quantity', v_plan,'updated_at', now(), 'operations', v_new_ops)
    WHERE id = v_wo.id;
  END LOOP;
END $$; COMMIT;