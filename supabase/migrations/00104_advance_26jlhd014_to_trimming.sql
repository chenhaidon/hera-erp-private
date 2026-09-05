BEGIN;
DO $$
DECLARE
  v_workers jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'name', data->>'name')) INTO v_workers
  FROM entity_store WHERE entity_type='employees' AND data->>'department'='生产部'
    AND data->>'position' IN ('缝纫工','裁剪工','包装工','整烫工','绗缝工','配料工','锁边工','搬运工','杂工');

  -- WO-2026-0016-1 SZ98870
  INSERT INTO entity_store (id, entity_type, data) VALUES ('f1f8a770-a6a5-4fad-816d-25deb35be6a3', 'work_orders', jsonb_build_object(
    'id','f1f8a770-a6a5-4fad-816d-25deb35be6a3','work_no','WO-2026-0016-1','contract_no','26JLHD014',
    'order_id','d37d1c82-85a9-443b-96a6-7937a1cebcee','order_no','SO-26JLHD014',
    'product_id','product-sz98870','product_code','SZ98870','product_name','希腊绒机绗被',
    'sku_id','sz98870-ok','sku_summary','112×106in + 20×36in×2','color','','plan_quantity',60,
    'completed_quantity',60,'status','running','progress',38,'source','plan','priority','medium',
    'start_date','2026-08-25','end_date','2026-09-26','issued_at','2026-08-25 08:00:00+08',
    'created_at','2026-08-25 08:00:00+08','updated_at',now(),'picking_status','completed',
    'operations', jsonb_build_array(
      jsonb_build_object('seq',1,'code','G-001','name','开料','skill','裁剪','device','裁剪机','category','internal','price',0.5,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',2,'code','G-008','name','电脑绣','skill','绣花','device','绣花机','category','outsourcing','price',0,'out_price',2,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','returned'),
      jsonb_build_object('seq',3,'code','G-002','name','剪边','skill','裁剪','device','剪边机','category','internal','price',0.3,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',4,'code','G-003','name','包边','skill','缝制','device','包边机','category','internal','price',0.6,'status','running','completed',false,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',5,'code','G-010','name','水洗','skill','水洗','device','水洗机','category','outsourcing','price',0,'out_price',1,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','pending'),
      jsonb_build_object('seq',6,'code','G-011','name','检验','skill','','device','','category','internal','price',0.5,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',7,'code','G-006','name','修补','skill','缝制','device','平缝机','category','internal','price',0.4,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',8,'code','G-007','name','包装','skill','包装','device','包装线','category','internal','price',0.3,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','')
    ),'product_category','SZ98870'
  ));
  INSERT INTO work_orders (work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, source, priority, start_date, end_date, sku_id, sku_summary, issued_at, created_at, updated_at)
  VALUES ('WO-2026-0016-1','SZ98870','希腊绒机绗被',60,60,38,'running','plan','medium','2026-08-25','2026-09-26','sz98870-ok','112×106in + 20×36in×2','2026-08-25 08:00:00+08','2026-08-25 08:00:00+08',now());

  -- WO-2026-0016-2 SZ26008
  INSERT INTO entity_store (id, entity_type, data) VALUES ('0614dbb6-8479-4595-bafd-c8ab879c59fa', 'work_orders', jsonb_build_object(
    'id','0614dbb6-8479-4595-bafd-c8ab879c59fa','work_no','WO-2026-0016-2','contract_no','26JLHD014',
    'order_id','d37d1c82-85a9-443b-96a6-7937a1cebcee','order_no','SO-26JLHD014',
    'product_id','product-sz26008','product_code','SZ26008','product_name','纯棉素色密绗被',
    'sku_id','sz26008-ok','sku_summary','112×106英寸 + 20×36英寸×2','color','米色','plan_quantity',60,
    'completed_quantity',60,'status','running','progress',38,'source','plan','priority','medium',
    'start_date','2026-08-25','end_date','2026-09-26','issued_at','2026-08-25 08:00:00+08',
    'created_at','2026-08-25 08:00:00+08','updated_at',now(),'picking_status','completed',
    'operations', jsonb_build_array(
      jsonb_build_object('seq',1,'code','G-001','name','开料','skill','裁剪','device','裁剪机','category','internal','price',0.5,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',2,'code','G-008','name','电脑绣','skill','绣花','device','绣花机','category','outsourcing','price',0,'out_price',2,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','returned'),
      jsonb_build_object('seq',3,'code','G-002','name','剪边','skill','裁剪','device','剪边机','category','internal','price',0.3,'status','completed','completed',true,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',4,'code','G-003','name','包边','skill','缝制','device','包边机','category','internal','price',0.6,'status','running','completed',false,'completed_qty',60,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',5,'code','G-010','name','水洗','skill','水洗','device','水洗机','category','outsourcing','price',0,'out_price',1,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','pending'),
      jsonb_build_object('seq',6,'code','G-011','name','检验','skill','','device','','category','internal','price',0.5,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',7,'code','G-006','name','修补','skill','缝制','device','平缝机','category','internal','price',0.4,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status',''),
      jsonb_build_object('seq',8,'code','G-007','name','包装','skill','包装','device','包装线','category','internal','price',0.3,'status','pending','completed',false,'completed_qty',0,'plan_qty',60,'reports','[]'::jsonb,'pqc_inspection_id',gen_random_uuid()::text,'dispatch_id','','return_qc_id','','outsourcing_status','')
    ),'product_category','SZ26008'
  ));
  INSERT INTO work_orders (work_no, product_code, product_name, plan_quantity, completed_quantity, progress, status, source, priority, start_date, end_date, sku_id, sku_summary, issued_at, created_at, updated_at)
  VALUES ('WO-2026-0016-2','SZ26008','纯棉素色密绗被',60,60,38,'running','plan','medium','2026-08-25','2026-09-26','sz26008-ok','112×106英寸 + 20×36英寸×2','2026-08-25 08:00:00+08','2026-08-25 08:00:00+08',now());
END $$;
COMMIT;
BEGIN;
DO $$
DECLARE
  v_wo_id text; v_work_no text; v_pcode text; v_pname text; v_color text; v_sku text;
  v_op jsonb; v_mr_id text; v_mr_code text; v_inv_id text; v_inv_qty int; v_remaining numeric;
BEGIN
  -- WO-2026-0016-1
  v_wo_id := 'f1f8a770-a6a5-4fad-816d-25deb35be6a3';
  v_work_no := 'WO-2026-0016-1'; v_pcode := 'SZ98870'; v_pname := '希腊绒机绗被'; v_color := ''; v_sku := 'sz98870-ok';
  v_mr_id := gen_random_uuid()::text; v_mr_code := 'MR-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
  INSERT INTO entity_store (id, entity_type, data) VALUES (v_mr_id, 'material_requisitions', jsonb_build_object(
    'id', v_mr_id, 'code', v_mr_code, 'work_order_id', v_wo_id, 'work_order_no', v_work_no,
    'contract_no', '26JLHD014', 'related_work_order_no', v_work_no, 'applicant', '应巧凤',
    'department', '生产部', 'status', 'completed', 'required_date', '2026-08-25',
    'issued_at', '2026-08-25 09:00:00', 'created_at', '2026-08-25 09:00:00', 'updated_at', now(),
    'remark', '按工单BOM发料',
    'items', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-a-greek-220','material_code','MAT-A-GREEK-220','material_name','A#220g希腊绒','unit','m','color',v_color,'required_qty',403.32,'issued_qty',403.32,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-b-cotton-40s','material_code','MAT-B-COTTON-40S','material_name','B#40S110/90棉布','unit','m','color',v_color,'required_qty',181.2,'issued_qty',181.2,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-nonwoven-25g','material_code','MAT-NONWOVEN-25G','material_name','25g无纺布','unit','m','color',v_color,'required_qty',15.12,'issued_qty',15.12,'warehouse','辅料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-c150-down','material_code','MAT-C150-DOWN','material_name','150g羽丝棉','unit','kg','color',v_color,'required_qty',75.06,'issued_qty',75.06,'warehouse','填充仓','specification','')
    )
  ));
  FOR v_op IN SELECT * FROM jsonb_array_elements((SELECT data->'items' FROM entity_store WHERE id=v_mr_id AND entity_type='material_requisitions')) LOOP
    v_remaining := round((v_op->>'issued_qty')::numeric);
    FOR v_inv_id, v_inv_qty IN
      SELECT id, COALESCE((data->>'quantity')::int,0) FROM entity_store
      WHERE entity_type='inventory' AND data->>'material_id'=v_op->>'material_id' ORDER BY COALESCE((data->>'quantity')::int,0) DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      IF v_inv_qty >= v_remaining THEN
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', (v_inv_qty - v_remaining)::int) WHERE id = v_inv_id;
        v_remaining := 0;
      ELSE
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', 0) WHERE id = v_inv_id;
        v_remaining := v_remaining - v_inv_qty;
      END IF;
    END LOOP;
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'record_no', 'MO-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
      'type', 'out', 'subtype', '生产领料', 'material_id', v_op->>'material_id', 'material_code', v_op->>'material_code',
      'material_name', v_op->>'material_name', 'quantity', (v_op->>'issued_qty')::numeric, 'unit', v_op->>'unit',
      'warehouse', v_op->>'warehouse', 'handler', '仓库管理员', 'record_date', '2026-08-25',
      'related_order', v_work_no, 'related_order_id', v_wo_id, 'contract_no', '26JLHD014',
      'remark', '工单发料', 'created_at', '2026-08-25T09:00:00+08:00'
    ));
  END LOOP;

  -- WO-2026-0016-2
  v_wo_id := '0614dbb6-8479-4595-bafd-c8ab879c59fa';
  v_work_no := 'WO-2026-0016-2'; v_pcode := 'SZ26008'; v_pname := '纯棉素色密绗被'; v_color := '米色'; v_sku := 'sz26008-ok';
  v_mr_id := gen_random_uuid()::text; v_mr_code := 'MR-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
  INSERT INTO entity_store (id, entity_type, data) VALUES (v_mr_id, 'material_requisitions', jsonb_build_object(
    'id', v_mr_id, 'code', v_mr_code, 'work_order_id', v_wo_id, 'work_order_no', v_work_no,
    'contract_no', '26JLHD014', 'related_work_order_no', v_work_no, 'applicant', '应巧凤',
    'department', '生产部', 'status', 'completed', 'required_date', '2026-08-25',
    'issued_at', '2026-08-25 09:00:00', 'created_at', '2026-08-25 09:00:00', 'updated_at', now(),
    'remark', '按工单BOM发料',
    'items', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-cotton-32s','material_code','MAT-COTTON-32S','material_name','32S68×62全棉素色布','unit','m','color',v_color,'required_qty',203.4,'issued_qty',203.4,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-nonwoven-25g','material_code','MAT-NONWOVEN-25G','material_name','25g无纺布','unit','m','color',v_color,'required_qty',190.8,'issued_qty',190.8,'warehouse','辅料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-c200-cotton','material_code','MAT-C200-COTTON','material_name','200g 90%漂白针刺棉','unit','kg','color',v_color,'required_qty',115.8,'issued_qty',115.8,'warehouse','填充仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text,'material_id','mat-quilt-thread','material_code','MAT-QUILT-THREAD','material_name','配色绗线','unit','万针','color',v_color,'required_qty',2580,'issued_qty',2580,'warehouse','辅料仓','specification','')
    )
  ));
  FOR v_op IN SELECT * FROM jsonb_array_elements((SELECT data->'items' FROM entity_store WHERE id=v_mr_id AND entity_type='material_requisitions')) LOOP
    v_remaining := round((v_op->>'issued_qty')::numeric);
    FOR v_inv_id, v_inv_qty IN
      SELECT id, COALESCE((data->>'quantity')::int,0) FROM entity_store
      WHERE entity_type='inventory' AND data->>'material_id'=v_op->>'material_id' ORDER BY COALESCE((data->>'quantity')::int,0) DESC
    LOOP
      EXIT WHEN v_remaining <= 0;
      IF v_inv_qty >= v_remaining THEN
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', (v_inv_qty - v_remaining)::int) WHERE id = v_inv_id;
        v_remaining := 0;
      ELSE
        UPDATE entity_store SET data = data || jsonb_build_object('quantity', 0) WHERE id = v_inv_id;
        v_remaining := v_remaining - v_inv_qty;
      END IF;
    END LOOP;
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'record_no', 'MO-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
      'type', 'out', 'subtype', '生产领料', 'material_id', v_op->>'material_id', 'material_code', v_op->>'material_code',
      'material_name', v_op->>'material_name', 'quantity', (v_op->>'issued_qty')::numeric, 'unit', v_op->>'unit',
      'warehouse', v_op->>'warehouse', 'handler', '仓库管理员', 'record_date', '2026-08-25',
      'related_order', v_work_no, 'related_order_id', v_wo_id, 'contract_no', '26JLHD014',
      'remark', '工单发料', 'created_at', '2026-08-25T09:00:00+08:00'
    ));
  END LOOP;
END $$;
COMMIT;
BEGIN;
DO $$
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
END $$;
COMMIT;
BEGIN;
DO $$
DECLARE
  v_qcs text[] := ARRAY['金灵芳','张卫国','方自伟'];
  v_wo record; v_op record;
  v_factory_id uuid; v_factory_name text;
  v_os_id text; v_or_id text; v_pfp_id text; v_os_no text; v_or_no text; v_pfp_code text;
  v_def int; v_qualified int; v_result text; v_reason text; v_phys_wo_id uuid;
  v_inv_id text;
BEGIN
  FOR v_wo IN
    SELECT id, data->>'work_no' AS work_no, data->>'product_code' AS product_code, data->>'product_name' AS product_name,
      data->>'sku_summary' AS spec, data->>'color' AS color, data->>'product_id' AS product_id
    FROM entity_store WHERE entity_type='work_orders' AND data->>'contract_no'='26JLHD014'
  LOOP
    SELECT id INTO v_phys_wo_id FROM work_orders WHERE work_no = v_wo.work_no LIMIT 1;
    SELECT of.id, of.data->>'factory_name' INTO v_factory_id, v_factory_name FROM entity_store of
    WHERE of.entity_type='outsource_factories' AND of.data->>'processing_capability' ILIKE '%绣花%' ORDER BY random() LIMIT 1;

    v_os_id := gen_random_uuid()::text; v_or_id := gen_random_uuid()::text; v_pfp_id := gen_random_uuid()::text;
    v_os_no := 'OS-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
    v_or_no := 'OR-2026-'||LPAD((floor(random()*9000+1000))::int::text,4,'0');
    v_pfp_code := 'PFP-26JLHD014-'||LPAD((floor(random()*900+100))::int::text,3,'0');
    v_def := CASE WHEN v_wo.work_no='WO-2026-0016-1' THEN 1 ELSE 0 END; v_qualified := 60 - v_def;
    v_result := CASE WHEN v_def>0 THEN 'partial' ELSE 'qualified' END; v_reason := CASE WHEN v_def>0 THEN '外观轻微瑕疵' ELSE '' END;

    INSERT INTO entity_store (id, entity_type, data) VALUES (v_os_id, 'outsource_shipments', jsonb_build_object(
      'id', v_os_id, 'shipment_no', v_os_no, 'contract_no', '26JLHD014', 'work_order_id', v_wo.id, 'work_order_no', v_wo.work_no,
      'operation_code', 'G-008', 'operation_name', '电脑绣', 'product_code', v_wo.product_code, 'product_name', v_wo.product_name,
      'factory_id', v_factory_id::text, 'factory_name', v_factory_name, 'shipment_date', '2026-08-26', 'shipment_quantity', 60, 'status', 'shipped',
      'items', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,'material_code', v_wo.product_code,'material_name', v_wo.product_name,'quantity', 60,'shipment_id', v_os_id,'unit','套')),
      'created_at', '2026-08-26T09:00:00+08:00', 'updated_at', '2026-08-26T09:00:00+08:00'
    ));
    INSERT INTO entity_store (id, entity_type, data) VALUES (v_or_id, 'outsource_returns', jsonb_build_object(
      'id', v_or_id, 'return_no', v_or_no, 'shipment_no', v_os_no, 'shipment_id', v_os_id, 'contract_no', '26JLHD014',
      'work_order_id', v_wo.id, 'work_order_no', v_wo.work_no, 'operation_code', 'G-008', 'operation_name', '电脑绣',
      'product_code', v_wo.product_code, 'product_name', v_wo.product_name, 'factory_id', v_factory_id::text, 'factory_name', v_factory_name,
      'return_date', '2026-08-31', 'return_quantity', 60, 'qualified_quantity', v_qualified, 'defective_quantity', v_def,
      'inspection_status', v_result, 'status', 'returned', 'return_type', 'semi_finished', 'defect_reason', v_reason,
      'inspector', v_qcs[1+floor(random()*3)::int],
      'items', jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text,'material_code', v_wo.product_code,'material_name', v_wo.product_name,'quantity', 60,'return_id', v_or_id,'unit','套')),
      'created_at', '2026-08-31T16:00:00+08:00', 'updated_at', '2026-08-31T16:00:00+08:00'
    ));
    INSERT INTO entity_store (id, entity_type, data) VALUES (v_pfp_id, 'processing_fee_payables', jsonb_build_object(
      'id', v_pfp_id, 'code', v_pfp_code, 'contract_no', '26JLHD014', 'work_order_id', v_wo.id, 'work_order_no', v_wo.work_no,
      'operation_code', 'G-008', 'operation_name', '电脑绣', 'factory_name', v_factory_name,
      'quantity', 60, 'unit_price', 2, 'total_amount', 120, 'paid_amount', 0,
      'status', 'pending', 'remark', '电脑绣外协加工费', 'created_at', '2026-08-31T16:00:00+08:00', 'updated_at', '2026-08-31T16:00:00+08:00'
    ));
    INSERT INTO outsource_shipments (id, shipment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, shipment_date, shipment_quantity, logistics_company, logistics_no, status, created_at, updated_at)
    VALUES (gen_random_uuid(), v_os_no, v_wo.id, v_wo.work_no, 'G-008', '电脑绣', v_wo.product_code, v_wo.product_name, v_factory_id, v_factory_name, '2026-08-26', 60, '安能物流', 'LOG-'||v_os_no, 'shipped', '2026-08-26 09:00:00+08', '2026-08-26 09:00:00+08');
    INSERT INTO outsource_returns (id, return_no, shipment_no, shipment_id, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, factory_id, factory_name, return_date, return_quantity, qualified_quantity, defective_quantity, inspection_status, status, return_type, defect_reason, inspector, created_at, updated_at)
    VALUES (gen_random_uuid(), v_or_no, v_os_no, (SELECT id FROM outsource_shipments WHERE shipment_no=v_os_no LIMIT 1), v_wo.id, v_wo.work_no, 'G-008', '电脑绣', v_wo.product_code, v_wo.product_name, v_factory_id, v_factory_name, '2026-08-31', 60, v_qualified, v_def, v_result, 'returned', 'semi_finished', v_reason, v_qcs[1+floor(random()*3)::int], '2026-08-31 16:00:00+08', '2026-08-31 16:00:00+08');
    INSERT INTO outsource_processing_payments (id, payment_no, work_order_id, work_order_no, operation_code, operation_name, product_code, product_name, product_spec, product_color, factory_id, factory_name, quantity, unit_price, amount, status, created_at, updated_at)
    VALUES (gen_random_uuid(), v_pfp_code, v_phys_wo_id, v_wo.work_no, 'G-008', '电脑绣', v_wo.product_code, v_wo.product_name, v_wo.spec, v_wo.color, v_factory_id, v_factory_name, 60, 2, 120, 'pending', '2026-08-31 16:00:00+08', '2026-08-31 16:00:00+08');

    -- 外协回货入库
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'record_no', 'WI-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
      'type', 'in', 'subtype', '外协回货入库', 'product_id', v_wo.product_id, 'product_code', v_wo.product_code, 'product_name', v_wo.product_name,
      'sku_id', CASE WHEN v_wo.work_no='WO-2026-0016-1' THEN 'sz98870-ok' ELSE 'sz26008-ok' END, 'quantity', 60,
      'warehouse', '外协仓', 'handler', '仓库管理员', 'record_date', '2026-08-31',
      'related_order', v_wo.work_no, 'related_order_id', v_wo.id, 'contract_no', '26JLHD014', 'remark', '电脑绣外协回货', 'created_at', '2026-08-31T16:00:00+08:00'
    ));

    -- 剪边完成后半成品入库
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'finished_goods_inbounds', jsonb_build_object(
      'id', gen_random_uuid()::text, 'inbound_no', 'RKS-26JLHD014-'||LPAD((floor(random()*900+100))::int::text,3,'0'),
      'work_id', v_wo.id, 'work_no', v_wo.work_no, 'product_id', v_wo.product_id, 'product_code', v_wo.product_code, 'product_name', v_wo.product_name,
      'quantity', 60, 'warehouse', '半成品仓', 'location_id', 'loc-semi-1', 'status', 'inbound',
      'inbound_date', '2026-09-03T18:00:00+08:00', 'contract_no', '26JLHD014', 'created_at', '2026-09-03T18:00:00+08:00'
    ));
    SELECT id INTO v_inv_id FROM entity_store WHERE entity_type='inventory' AND data->>'product_id'=v_wo.product_id AND data->>'warehouse'='半成品仓' LIMIT 1;
    IF v_inv_id IS NOT NULL THEN
      UPDATE entity_store SET data = data || jsonb_build_object('quantity', COALESCE((data->>'quantity')::int,0) + 60) WHERE id = v_inv_id;
    ELSE
      INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'inventory', jsonb_build_object(
        'id', gen_random_uuid()::text, 'product_id', v_wo.product_id, 'product_code', v_wo.product_code, 'product_name', v_wo.product_name,
        'sku_id', CASE WHEN v_wo.work_no='WO-2026-0016-1' THEN 'sz98870-ok' ELSE 'sz26008-ok' END,
        'quantity', 60, 'warehouse', '半成品仓', 'created_at', now()
      ));
    END IF;
  END LOOP;
END $$;
COMMIT;
BEGIN;
DO $$
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
END $$;
COMMIT;
