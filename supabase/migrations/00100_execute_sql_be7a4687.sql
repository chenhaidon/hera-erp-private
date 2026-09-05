BEGIN; DO $$
DECLARE
  v_workers jsonb;
  v_wo record;
  v_ops jsonb; v_new_ops jsonb;
  v_op jsonb;
  v_op_code text; v_op_name text;
  v_work_no text; v_wid text; v_plan int; v_completed int; v_remaining int; v_batch int;
  v_price numeric;
  v_spec text; v_color text; v_pcode text; v_pname text; v_pid text;
  v_reports jsonb; v_all jsonb; v_rep jsonb;
  v_sorted jsonb[];
  v_n int; v_i int; v_k int;
  v_start timestamptz; v_end_t timestamptz; v_step interval; v_t timestamptz;
  v_worker jsonb;
  v_os_no text; v_or_no text; v_pfp_code text;
  v_os_id text; v_or_id text; v_pfp_id text;
  v_phys_os_id uuid; v_phys_or_id uuid; v_phys_wo_id uuid;
  v_factory_uuid uuid;
  v_def int; v_qualified int; v_result text; v_reason text;
  v_pi_code text; v_pi_id text; v_pi_date text;
  v_pi_num int := 400;
  v_inspector text;
  v_qcs text[] := ARRAY['金灵芳','张卫国','方自伟'];
  v_ins_idx int := 0;
  v_exists int;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', e.data->>'id', 'name', e.data->>'name')) INTO v_workers
  FROM entity_store e WHERE e.entity_type='employees' AND e.data->>'department'='生产部'
    AND e.data->>'position' IN ('缝纫工','裁剪工','包装工','整烫工','绗缝工','配料工','锁边工','搬运工','杂工');

  FOR v_wo IN SELECT id, data FROM entity_store WHERE entity_type='work_orders' AND data->>'contract_no'='26JLHD015' ORDER BY data->>'work_no'
  LOOP
    v_wid := v_wo.data->>'id';
    v_work_no := v_wo.data->>'work_no';
    v_plan := COALESCE((v_wo.data->>'plan_quantity')::int,0);
    v_spec := COALESCE(v_wo.data->>'sku_summary','');
    v_color := COALESCE(v_wo.data->>'color','');
    v_pcode := v_wo.data->>'product_code';
    v_pname := v_wo.data->>'product_name';
    v_pid := v_wo.data->>'product_id';
    v_ops := v_wo.data->'operations';
    v_new_ops := '[]'::jsonb;

    IF v_work_no = 'WO-2026-0012-1' THEN
      v_os_no := 'OS-2026-0052'; v_or_no := 'OR-2026-0050'; v_pfp_code := 'PFP-26JLHD015-21';
      v_factory_uuid := '9db5f995-0d4d-452f-8e0a-7257c038f381'::uuid;
    ELSE
      v_os_no := 'OS-2026-0053'; v_or_no := 'OR-2026-0051'; v_pfp_code := 'PFP-26JLHD015-22';
      v_factory_uuid := 'a27e83b3-d15b-4cfc-aeb1-82929aacc2ac'::uuid;
    END IF;

    -- 物理工单表
    SELECT id INTO v_phys_wo_id FROM work_orders WHERE work_orders.work_no = v_work_no LIMIT 1;
    IF v_phys_wo_id IS NULL THEN
      INSERT INTO work_orders (work_no, product_code, product_name, plan_quantity, status, source, priority)
      VALUES (v_work_no, v_pcode, v_pname, v_plan, 'completed','plan','medium') RETURNING id INTO v_phys_wo_id;
    ELSE
      UPDATE work_orders SET status='completed' WHERE id=v_phys_wo_id;
    END IF;

    FOR v_i IN 0 .. jsonb_array_length(v_ops)-1 LOOP
      v_op := v_ops->v_i;
      v_op_code := v_op->>'code';
      v_op_name := v_op->>'name';
      v_completed := COALESCE((v_op->>'completed_qty')::int,0);
      v_price := CASE v_op_code WHEN 'G-001' THEN 0.5 WHEN 'G-002' THEN 0.3 WHEN 'G-003' THEN 0.6 WHEN 'G-006' THEN 0.4 WHEN 'G-007' THEN 0.3 WHEN 'G-008' THEN 2 WHEN 'G-010' THEN 1 ELSE 0 END;
      v_ins_idx := v_ins_idx + 1; v_inspector := v_qcs[1 + v_ins_idx % 3];

      v_start := CASE
        WHEN v_op_code='G-001' THEN '2026-08-13 08:00:00+08'::timestamptz
        WHEN v_op_code='G-008' THEN '2026-08-21 08:00:00+08'::timestamptz
        WHEN v_op_code='G-002' AND v_work_no='WO-2026-0012-1' THEN '2026-08-23 10:00:00+08'::timestamptz
        WHEN v_op_code='G-002' THEN '2026-08-25 14:00:00+08'::timestamptz
        WHEN v_op_code='G-003' THEN '2026-08-29 14:00:00+08'::timestamptz
        WHEN v_op_code='G-010' THEN '2026-09-01 08:00:00+08'::timestamptz
        WHEN v_op_code='G-011' THEN '2026-09-03 08:00:00+08'::timestamptz
        WHEN v_op_code='G-006' THEN '2026-09-03 16:00:00+08'::timestamptz
        ELSE '2026-09-04 09:00:00+08'::timestamptz END;
      v_end_t := CASE
        WHEN v_op_code='G-001' THEN '2026-08-20 18:00:00+08'::timestamptz
        WHEN v_op_code='G-008' THEN '2026-08-22 18:00:00+08'::timestamptz
        WHEN v_op_code='G-002' THEN '2026-08-29 12:00:00+08'::timestamptz
        WHEN v_op_code='G-003' THEN '2026-08-31 18:00:00+08'::timestamptz
        WHEN v_op_code='G-010' THEN '2026-09-02 18:00:00+08'::timestamptz
        WHEN v_op_code='G-011' THEN '2026-09-03 16:00:00+08'::timestamptz
        WHEN v_op_code='G-006' THEN '2026-09-04 09:00:00+08'::timestamptz
        ELSE '2026-09-04 17:00:00+08'::timestamptz END;

      v_reports := COALESCE(v_op->'reports','[]'::jsonb);
      SELECT array_agg(x ORDER BY (x->>'report_time')::timestamptz) INTO v_sorted
      FROM jsonb_array_elements(v_reports) AS x;
      v_all := COALESCE(to_jsonb(v_sorted), '[]'::jsonb);

      v_remaining := v_plan - v_completed;
      WHILE v_remaining > 0 LOOP
        v_batch := CASE v_op_code
          WHEN 'G-002' THEN 150 + floor(random()*20)::int
          WHEN 'G-003' THEN 200 + floor(random()*100)::int
          WHEN 'G-010' THEN 100
          ELSE 50 + floor(random()*40)::int END;
        IF v_batch > v_remaining THEN v_batch := v_remaining; END IF;
        v_worker := v_workers->(floor(random()*jsonb_array_length(v_workers))::int);
        v_all := v_all || jsonb_build_array(jsonb_build_object(
          'id', gen_random_uuid()::text, 'operation_code', v_op_code, 'operation_name', v_op_name,
          'operator_id', v_worker->>'id', 'operator_name', v_worker->>'name',
          'qty', v_batch, 'quantity', v_batch, 'unit_price', v_price, 'amount', round(v_batch*v_price,2),
          'color', v_color, 'spec', v_spec, 'remark', '计件报工',
          'report_time', to_char(v_start AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"HH24:MI:SS"+08:00"'),
          'work_no', v_work_no
        ));
        v_remaining := v_remaining - v_batch;
      END LOOP;

      v_n := jsonb_array_length(v_all);
      IF v_n > 0 THEN
        v_step := (v_end_t - v_start) / v_n;
        v_reports := '[]'::jsonb;
        FOR v_k IN 0 .. v_n-1 LOOP
          v_t := v_start + v_step * (v_k + random()*0.5);
          IF v_t > v_end_t THEN v_t := v_end_t; END IF;
          v_rep := v_all->v_k;
          v_rep := jsonb_set(v_rep, '{report_time}', to_jsonb(to_char(v_t AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD"T"HH24:MI:SS"+08:00"')));
          v_rep := jsonb_set(v_rep, '{spec}', to_jsonb(v_spec));
          v_reports := v_reports || jsonb_build_array(v_rep);
        END LOOP;
        v_op := jsonb_set(v_op, '{reports}', v_reports);
      END IF;

      v_op := jsonb_set(v_op, '{completed_qty}', to_jsonb(v_plan));
      v_op := jsonb_set(v_op, '{status}', '"completed"'::jsonb);
      v_op := jsonb_set(v_op, '{completed}', 'true'::jsonb);
      IF COALESCE(v_op->>'pqc_inspection_id','') = '' THEN
        v_op := jsonb_set(v_op, '{pqc_inspection_id}', to_jsonb(gen_random_uuid()::text));
      END IF;

      -- G-010 水洗外协：发料单/回货单/加工款应付（entity + 物理表）
      IF v_op_code = 'G-010' THEN
        v_os_id := gen_random_uuid()::text;
        v_or_id := gen_random_uuid()::text;
        v_pfp_id := gen_random_uuid()::text;
        v_def := CASE WHEN v_work_no='WO-2026-0012-1' THEN 1 ELSE 0 END;
        v_qualified := v_plan - v_def;
        v_result := CASE WHEN v_def>0 THEN 'partial' ELSE 'qualified' END;
        v_reason := CASE WHEN v_def>0 THEN '外观轻微瑕疵' ELSE '' END;

        INSERT INTO entity_store (id, entity_type, data) VALUES (v_os_id, 'outsource_shipments',
          jsonb_build_object('id', v_os_id, 'shipment_no', v_os_no, 'contract_no','26JLHD015',
            'work_order_id', v_wid, 'work_order_no', v_work_no,
            'operation_code','G-010','operation_name','水洗',
            'product_code', v_pcode, 'product_name', v_pname,
            'factory_id','factory-shuixi','factory_name','外协水洗厂',
            'shipment_date','2026-08-31','shipment_quantity', v_plan,'status','shipped',
            'items', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,'material_code', v_pcode,'material_name', v_pname,'quantity', v_plan,'shipment_id', v_os_id,'unit','套')),
            'created_at','2026-08-31T09:00:00+08:00','updated_at','2026-08-31T09:00:00+08:00'));

        INSERT INTO entity_store (id, entity_type, data) VALUES (v_or_id, 'outsource_returns',
          jsonb_build_object('id', v_or_id, 'return_no', v_or_no, 'shipment_no', v_os_no, 'shipment_id', v_os_id,
            'contract_no','26JLHD015','work_order_id', v_wid, 'work_order_no', v_work_no,
            'operation_code','G-010','operation_name','水洗',
            'product_code', v_pcode, 'product_name', v_pname,
            'factory_id','factory-shuixi','factory_name','外协水洗厂',
            'return_date','2026-09-02','return_quantity', v_plan,'qualified_quantity', v_qualified,
            'defective_quantity', v_def,'inspection_status', v_result,'status','returned','return_type','semi_finished',
            'defect_reason', v_reason,'inspector', v_inspector,
            'items', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,'material_code', v_pcode,'material_name', v_pname,'quantity', v_plan,'return_id', v_or_id,'unit','套')),
            'created_at','2026-09-02T16:00:00+08:00','updated_at','2026-09-02T16:00:00+08:00'));

        INSERT INTO entity_store (id, entity_type, data) VALUES (v_pfp_id, 'processing_fee_payables',
          jsonb_build_object('id', v_pfp_id, 'code', v_pfp_code, 'contract_no','26JLHD015',
            'work_order_id', v_wid, 'work_order_no', v_work_no,
            'operation_code','G-010','operation_name','水洗',
            'factory_name','外协水洗厂',
            'quantity', v_plan,'unit_price',1,'total_amount', v_plan,'paid_amount',0,
            'status','pending','remark','水洗外协加工费',
            'created_at','2026-09-02T16:00:00+08:00','updated_at','2026-09-02T16:00:00+08:00'));

        v_phys_os_id := gen_random_uuid();
        INSERT INTO outsource_shipments (id, shipment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, shipment_date, shipment_quantity, logistics_company, logistics_no, status, created_at, updated_at)
        VALUES (v_phys_os_id, v_os_no, v_wid, v_work_no, 'G-010','水洗', v_pcode, v_pname, v_factory_uuid, CASE WHEN v_work_no='WO-2026-0012-1' THEN '楼根善' ELSE '陈红星' END, '2026-08-31', v_plan, '安能物流', 'LOG-'||v_os_no, 'shipped', '2026-08-31 09:00:00+08','2026-08-31 09:00:00+08');
        v_phys_or_id := gen_random_uuid();
        INSERT INTO outsource_returns (id, return_no, shipment_no, shipment_id, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, return_date, return_quantity, qualified_quantity, defective_quantity, inspection_status, status, return_type, defect_reason, inspector, created_at, updated_at)
        VALUES (v_phys_or_id, v_or_no, v_os_no, v_phys_os_id, v_wid, v_work_no, 'G-010','水洗', v_pcode, v_pname, v_factory_uuid, CASE WHEN v_work_no='WO-2026-0012-1' THEN '楼根善' ELSE '陈红星' END, '2026-09-02', v_plan, v_qualified, v_def, v_result, 'returned','semi_finished', v_reason, v_inspector, '2026-09-02 16:00:00+08','2026-09-02 16:00:00+08');
        INSERT INTO outsource_processing_payments (id, payment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, product_spec, product_color, factory_id, factory_name, quantity, unit_price, amount, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_pfp_code, v_phys_wo_id, v_work_no, 'G-010','水洗', v_pcode, v_pname, v_spec, v_color, v_factory_uuid, CASE WHEN v_work_no='WO-2026-0012-1' THEN '楼根善' ELSE '陈红星' END, v_plan, 1, v_plan, 'pending', '2026-09-02 16:00:00+08','2026-09-02 16:00:00+08');

        v_op := jsonb_set(v_op, '{outsourcing_status}', '"returned"'::jsonb);
        v_op := jsonb_set(v_op, '{dispatch_id}', to_jsonb(v_os_id));
        v_op := jsonb_set(v_op, '{return_qc_id}', to_jsonb(v_or_id));
      END IF;

      -- 过程检查（G-001/G-008 已有）
      IF v_op_code NOT IN ('G-001','G-008') THEN
        SELECT count(*) INTO v_exists FROM entity_store pi
        WHERE pi.entity_type='process_inspections' AND pi.data->>'work_no'=v_work_no AND pi.data->>'operation_code'=v_op_code;
        IF v_exists = 0 THEN
          v_pi_num := v_pi_num + 1;
          v_pi_id := gen_random_uuid()::text;
          v_pi_code := 'PI-26JLHD015-'||v_pi_num::text;
          v_pi_date := CASE v_op_code WHEN 'G-002' THEN '2026-08-29' WHEN 'G-003' THEN '2026-08-31' WHEN 'G-010' THEN '2026-09-02' WHEN 'G-011' THEN '2026-09-03' ELSE '2026-09-04' END;
          v_def := CASE
            WHEN v_op_code='G-003' AND v_work_no='WO-2026-0012-1' THEN 2
            WHEN v_op_code='G-011' AND v_work_no='WO-2026-0012-2' THEN 1
            WHEN v_op_code='G-010' AND v_work_no='WO-2026-0012-1' THEN 1
            ELSE 0 END;
          v_qualified := v_plan - v_def;
          v_result := CASE WHEN v_def>0 THEN 'partial' ELSE 'qualified' END;
          v_reason := CASE WHEN v_def>0 THEN '外观轻微瑕疵' ELSE '' END;
          INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections',
            jsonb_build_object('id', v_pi_id, 'code', v_pi_code, 'contract_no','26JLHD015',
              'work_id', v_wid, 'work_no', v_work_no, 'work_order_id', v_wid, 'work_order_no', v_work_no,
              'operation_code', v_op_code, 'operation_name', v_op_name,
              'check_date', v_pi_date, 'check_qty', v_plan, 'qualified_qty', v_qualified, 'unqualified_qty', v_def,
              'qualified_rate', round(v_qualified::numeric/NULLIF(v_plan,0)*100,2)::text||'%',
              'result', v_result, 'status','inspected', 'defect_reason', v_reason, 'inspector', v_inspector,
              'items', jsonb_build_array(
                jsonb_build_object('id', gen_random_uuid()::text,'category','appearance','name','外观缺陷','standard',0,'lower',0,'upper',1,'actual',0,'unit','处','result','qualified'),
                jsonb_build_object('id', gen_random_uuid()::text,'category','physical','name','尺寸偏差','standard',0,'lower',-2,'upper',2,'actual', CASE WHEN v_def>0 THEN 1 ELSE 0 END,'unit','mm','result','qualified')),
              'created_at', v_pi_date||'T17:00:00+08:00', 'updated_at', v_pi_date||'T17:00:00+08:00'));
        END IF;
      END IF;

      v_new_ops := v_new_ops || jsonb_build_array(v_op);
    END LOOP;

    -- 成品检验
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'finished_inspections',
      jsonb_build_object('id', gen_random_uuid()::text,
        'code', 'FI-26JLHD015-'||CASE WHEN v_work_no='WO-2026-0012-1' THEN '001' ELSE '002' END,
        'work_id', v_wid, 'work_no', v_work_no, 'product_id', v_pid, 'product_code', v_pcode, 'product_name', v_pname,
        'color', v_color, 'batch', 'FB-26JLHD015-'||CASE WHEN v_work_no='WO-2026-0012-1' THEN '001' ELSE '002' END,
        'check_qty', v_plan, 'qualified_qty', v_plan, 'unqualified_qty', 0, 'result','qualified','status','inspected',
        'inspector', CASE WHEN v_work_no='WO-2026-0012-1' THEN '金灵芳' ELSE '张卫国' END,
        'created_at','2026-09-04T17:30:00+08:00','contract_no','26JLHD015','defect_reason','',
        'items', jsonb_build_array(
          jsonb_build_object('category','appearance','name','外观质量','standard',4,'lower',3,'upper',5,'actual',4.5,'result','qualified','unit','级'),
          jsonb_build_object('category','physical','name','尺寸偏差','standard',2,'lower',0,'upper',3,'actual',1.2,'result','qualified','unit','%'),
          jsonb_build_object('category','physical','name','缝制牢度','standard',100,'lower',80,'upper',150,'actual',120,'result','qualified','unit','N'),
          jsonb_build_object('category','physical','name','绗缝均匀度','standard',4,'lower',3,'upper',5,'actual',4.5,'result','qualified','unit','级'))));

    -- 完工入库
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'finished_goods_inbounds',
      jsonb_build_object('id', gen_random_uuid()::text,
        'inbound_no', 'RKS-26JLHD015-'||CASE WHEN v_work_no='WO-2026-0012-1' THEN '001' ELSE '002' END,
        'work_id', v_wid, 'work_no', v_work_no, 'product_id', v_pid, 'product_code', v_pcode, 'product_name', v_pname,
        'quantity', v_plan, 'status','inbound','warehouse','成品仓',
        'location_id', CASE WHEN v_work_no='WO-2026-0012-1' THEN 'loc-finished-2' ELSE 'loc-finished-1' END,
        'inbound_date','2026-09-04T18:00:00+08:00','created_at','2026-09-04T18:00:00+08:00','contract_no','26JLHD015'));

    -- 库存：生产入库记录 + 库存同步
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records',
      jsonb_build_object('id', gen_random_uuid()::text, 'record_no','WI-'||floor(random()*900000+100000)::int::text,
        'type','in','subtype','生产入库','product_id', v_pid,'product_code', v_pcode,'product_name', v_pname,
        'sku_id', CASE WHEN v_work_no='WO-2026-0012-1' THEN 'sz26008-qxl' ELSE 'sz26008-kxl' END,
        'quantity', v_plan,'warehouse','成品仓','handler','仓库管理员',
        'record_date','2026-09-04','related_order', v_work_no,'related_order_id', v_wid,
        'remark','工单完工入库','created_at','2026-09-04T18:00:00+08:00','contract_no','26JLHD015'));
    UPDATE entity_store SET data = data || jsonb_build_object('quantity', COALESCE((data->>'quantity')::int,0)+v_plan, 'updated_at','2026-09-04T18:00:00+08:00')
    WHERE id = CASE WHEN v_work_no='WO-2026-0012-1' THEN 'DcWqUN92oaev6qkHFvcQY' ELSE 'gPc6iYxNt_-CeUXNDJK79' END;

    UPDATE entity_store SET data = data || jsonb_build_object(
      'status','completed','completed_quantity', v_plan,'progress',100,
      'completed_at','2026-09-04T17:00:00+08:00','updated_at', now(), 'operations', v_new_ops)
    WHERE id = v_wo.id;
  END LOOP;
END $$; COMMIT;