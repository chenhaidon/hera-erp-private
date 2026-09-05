BEGIN; DO $$
DECLARE
  v_qty int := 300;
  v_price numeric := 168;
  v_total numeric := 100800;
  v_so_id text := 'd37d1c82-85a9-443b-96a6-7937a1cebcee';
  v_contract_id text := 'cd0ce16d-c951-46ca-9d0c-9f8b791bfdb4';
  v_ar_id text := '4712effc-ec17-4a7e-81f8-758ae65a6197';
  v_wo1_es_id text := 'f1f8a770-a6a5-4fad-816d-25deb35be6a3';
  v_wo2_es_id text := '0614dbb6-8479-4595-bafd-c8ab879c59fa';
  v_wo1_phys_id uuid;
  v_wo2_phys_id uuid;
  v_ops1 jsonb; v_ops2 jsonb;
  v_pqc_g1_1 text := gen_random_uuid()::text;
  v_pqc_g8_1 text := gen_random_uuid()::text;
  v_pqc_g2_1 text := gen_random_uuid()::text;
  v_pqc_g1_2 text := gen_random_uuid()::text;
  v_pqc_g8_2 text := gen_random_uuid()::text;
  v_pqc_g2_2 text := gen_random_uuid()::text;
  v_mr_id text; v_mr_code text;
  v_item jsonb;
  v_salary jsonb := '{}'::jsonb;
  v_wid text; v_wname text; v_amount numeric;
BEGIN
  -- 1. 更新销售订单
  UPDATE entity_store SET data = data
    || jsonb_build_object('total_amount', v_total, 'updated_at', now())
    || jsonb_build_object('items', (
      SELECT jsonb_agg(
        CASE
          WHEN el->>'sku_id' = 'sz98870-ok' THEN el || jsonb_build_object('quantity', v_qty, 'unit_price', v_price, 'amount', v_qty * v_price)
          WHEN el->>'sku_id' = 'sz26008-ok' THEN el || jsonb_build_object('quantity', v_qty, 'unit_price', v_price, 'amount', v_qty * v_price)
          ELSE el
        END
      ) FROM jsonb_array_elements(data->'items') el
    ))
  WHERE id = v_so_id AND entity_type = 'sales_orders';

  -- 2. 更新合同
  UPDATE entity_store SET data = data
    || jsonb_build_object('amount', v_total, 'updated_at', now())
    || jsonb_build_object('items', (
      SELECT jsonb_agg(
        CASE
          WHEN el->>'sku_id' = 'sz98870-ok' THEN el || jsonb_build_object('quantity', v_qty, 'unit_price', v_price, 'total_price', v_qty * v_price)
          WHEN el->>'sku_id' = 'sz26008-ok' THEN el || jsonb_build_object('quantity', v_qty, 'unit_price', v_price, 'total_price', v_qty * v_price)
          ELSE el
        END
      ) FROM jsonb_array_elements(data->'items') el
    ))
  WHERE id = v_contract_id AND entity_type = 'contracts';

  -- 3. 应收账款金额保持一致
  UPDATE entity_store SET data = data || jsonb_build_object('amount', v_total, 'updated_at', now())
  WHERE id = v_ar_id AND entity_type = 'finance_records';

  -- 4. 清理旧下游数据
  DELETE FROM entity_store WHERE entity_type = 'material_requisitions' AND data->>'contract_no' = '26JLHD014';
  DELETE FROM entity_store WHERE entity_type = 'finished_goods_inbounds' AND data->>'contract_no' = '26JLHD014';
  DELETE FROM entity_store WHERE entity_type = 'process_inspections' AND data->>'contract_no' = '26JLHD014';
  DELETE FROM entity_store WHERE entity_type = 'stock_records' AND data->>'contract_no' = '26JLHD014' AND data->>'subtype' IN ('生产领料','外协回货入库');
  DELETE FROM entity_store WHERE entity_type = 'salary_records' AND data->>'month' = '2026-09' AND data->>'remark' = '计件工资'
    AND data->>'employee_id' IN (
      SELECT DISTINCT r->>'operator_id'
      FROM entity_store e,
           jsonb_array_elements(e.data->'operations') o,
           jsonb_array_elements(o->'reports') r
      WHERE e.entity_type = 'work_orders' AND e.data->>'contract_no' = '26JLHD014'
    );

  -- 5. 重新构造工单 operations（进度到剪边完成，包边及后续 pending）
  v_ops1 := jsonb_build_array(
    jsonb_build_object(
      'seq', 1, 'code', 'G-001', 'name', '开料', 'price', 0.5, 'out_price', 0, 'skill', '裁剪', 'device', '裁剪机',
      'category', 'internal', 'status', 'completed', 'completed', true,
      'plan_qty', v_qty, 'completed_qty', v_qty,
      'dispatch_id', '', 'return_qc_id', '', 'outsourcing_status', '', 'pqc_inspection_id', v_pqc_g1_1,
      'reports', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 80, 'quantity', 80, 'unit_price', 0.5, 'amount', round(80 * 0.5, 2), 'operator_id', '4f2f42a3-c1eb-4f95-8ebb-e64e69ae18a3', 'operator_name', '高巧云', 'report_time', '2026-08-25T15:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 70, 'quantity', 70, 'unit_price', 0.5, 'amount', round(70 * 0.5, 2), 'operator_id', 'uGOgVcduB26ljUtPJX-Sp', 'operator_name', '张梦瑶', 'report_time', '2026-08-26T08:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 80, 'quantity', 80, 'unit_price', 0.5, 'amount', round(80 * 0.5, 2), 'operator_id', 'a2d9377c-6b89-4e7e-9af3-435c03d38d9d', 'operator_name', '李秀英', 'report_time', '2026-08-26T20:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 70, 'quantity', 70, 'unit_price', 0.5, 'amount', round(70 * 0.5, 2), 'operator_id', '237b6f20-dded-41c7-9817-762aa1934e26', 'operator_name', '徐宝根', 'report_time', '2026-08-27T08:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工')
      )
    ),
    jsonb_build_object(
      'seq', 2, 'code', 'G-008', 'name', '电脑绣', 'price', 0, 'out_price', 2, 'skill', '绣花', 'device', '绣花机',
      'category', 'outsourcing', 'status', 'completed', 'completed', true,
      'plan_qty', v_qty, 'completed_qty', v_qty,
      'dispatch_id', '', 'return_qc_id', '', 'outsourcing_status', 'returned', 'pqc_inspection_id', v_pqc_g8_1,
      'reports', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-008', 'operation_name', '电脑绣', 'qty', 120, 'quantity', 120, 'unit_price', 2, 'amount', round(120 * 2, 2), 'operator_id', 'HJ6OmTJ7Z3d1ZStnurV1P', 'operator_name', '陈红星', 'report_time', '2026-08-28T15:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-008', 'operation_name', '电脑绣', 'qty', 100, 'quantity', 100, 'unit_price', 2, 'amount', round(100 * 2, 2), 'operator_id', '22eed93d-9508-4adb-8c30-6bf1b54784a8', 'operator_name', '刘桂兰', 'report_time', '2026-08-29T15:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-008', 'operation_name', '电脑绣', 'qty', 80, 'quantity', 80, 'unit_price', 2, 'amount', round(80 * 2, 2), 'operator_id', 'USicMLjAzaF8wbDPYdIwA', 'operator_name', '应巧凤', 'report_time', '2026-08-30T10:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工')
      )
    ),
    jsonb_build_object(
      'seq', 3, 'code', 'G-002', 'name', '剪边', 'price', 0.3, 'out_price', 0, 'skill', '裁剪', 'device', '剪边机',
      'category', 'internal', 'status', 'completed', 'completed', true,
      'plan_qty', v_qty, 'completed_qty', v_qty,
      'dispatch_id', '', 'return_qc_id', '', 'outsourcing_status', '', 'pqc_inspection_id', v_pqc_g2_1,
      'reports', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 70, 'quantity', 70, 'unit_price', 0.3, 'amount', round(70 * 0.3, 2), 'operator_id', '2d27fcc9-b23c-4da6-8d2f-455bbb55da9f', 'operator_name', '王建国', 'report_time', '2026-08-30T22:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 80, 'quantity', 80, 'unit_price', 0.3, 'amount', round(80 * 0.3, 2), 'operator_id', '0ff9a248-2418-42db-92fd-28b2c60de100', 'operator_name', '张卫国', 'report_time', '2026-09-01T14:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 60, 'quantity', 60, 'unit_price', 0.3, 'amount', round(60 * 0.3, 2), 'operator_id', 'cefb9e56-a0b0-4746-a6e5-82c3f50eb051', 'operator_name', '陈海涛', 'report_time', '2026-09-03T09:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 50, 'quantity', 50, 'unit_price', 0.3, 'amount', round(50 * 0.3, 2), 'operator_id', '8626ded5-184b-46cc-8d22-b7851205f9c2', 'operator_name', '孙长贵', 'report_time', '2026-09-05T09:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 40, 'quantity', 40, 'unit_price', 0.3, 'amount', round(40 * 0.3, 2), 'operator_id', '31d595c6-d6cf-4eee-a540-6ea38d03cc59', 'operator_name', '吴德明', 'report_time', '2026-09-06T10:00:00+08:00', 'work_no', 'WO-2026-0016-1', 'spec', '112×106in + 20×36in×2', 'color', '', 'remark', '计件报工')
      )
    ),
    jsonb_build_object('seq',4,'code','G-003','name','包边','price',0.6,'out_price',0,'skill','缝制','device','包边机','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',5,'code','G-010','name','水洗','price',0,'out_price',1,'skill','水洗','device','水洗机','category','outsourcing','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','pending','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',6,'code','G-011','name','检验','price',0.5,'out_price',0,'skill','','device','','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',7,'code','G-006','name','修补','price',0.4,'out_price',0,'skill','缝制','device','平缝机','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',8,'code','G-007','name','包装','price',0.3,'out_price',0,'skill','包装','device','包装线','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb)
  );

  v_ops2 := jsonb_build_array(
    jsonb_build_object(
      'seq', 1, 'code', 'G-001', 'name', '开料', 'price', 0.5, 'out_price', 0, 'skill', '裁剪', 'device', '裁剪机',
      'category', 'internal', 'status', 'completed', 'completed', true,
      'plan_qty', v_qty, 'completed_qty', v_qty,
      'dispatch_id', '', 'return_qc_id', '', 'outsourcing_status', '', 'pqc_inspection_id', v_pqc_g1_2,
      'reports', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 90, 'quantity', 90, 'unit_price', 0.5, 'amount', round(90 * 0.5, 2), 'operator_id', '4f2f42a3-c1eb-4f95-8ebb-e64e69ae18a3', 'operator_name', '高巧云', 'report_time', '2026-08-25T20:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 80, 'quantity', 80, 'unit_price', 0.5, 'amount', round(80 * 0.5, 2), 'operator_id', 'uGOgVcduB26ljUtPJX-Sp', 'operator_name', '张梦瑶', 'report_time', '2026-08-26T09:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 70, 'quantity', 70, 'unit_price', 0.5, 'amount', round(70 * 0.5, 2), 'operator_id', 'a2d9377c-6b89-4e7e-9af3-435c03d38d9d', 'operator_name', '李秀英', 'report_time', '2026-08-26T21:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-001', 'operation_name', '开料', 'qty', 60, 'quantity', 60, 'unit_price', 0.5, 'amount', round(60 * 0.5, 2), 'operator_id', '237b6f20-dded-41c7-9817-762aa1934e26', 'operator_name', '徐宝根', 'report_time', '2026-08-27T07:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工')
      )
    ),
    jsonb_build_object(
      'seq', 2, 'code', 'G-008', 'name', '电脑绣', 'price', 0, 'out_price', 2, 'skill', '绣花', 'device', '绣花机',
      'category', 'outsourcing', 'status', 'completed', 'completed', true,
      'plan_qty', v_qty, 'completed_qty', v_qty,
      'dispatch_id', '', 'return_qc_id', '', 'outsourcing_status', 'returned', 'pqc_inspection_id', v_pqc_g8_2,
      'reports', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-008', 'operation_name', '电脑绣', 'qty', 110, 'quantity', 110, 'unit_price', 2, 'amount', round(110 * 2, 2), 'operator_id', 'HJ6OmTJ7Z3d1ZStnurV1P', 'operator_name', '陈红星', 'report_time', '2026-08-28T16:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-008', 'operation_name', '电脑绣', 'qty', 100, 'quantity', 100, 'unit_price', 2, 'amount', round(100 * 2, 2), 'operator_id', '22eed93d-9508-4adb-8c30-6bf1b54784a8', 'operator_name', '刘桂兰', 'report_time', '2026-08-29T16:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-008', 'operation_name', '电脑绣', 'qty', 90, 'quantity', 90, 'unit_price', 2, 'amount', round(90 * 2, 2), 'operator_id', 'USicMLjAzaF8wbDPYdIwA', 'operator_name', '应巧凤', 'report_time', '2026-08-30T08:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工')
      )
    ),
    jsonb_build_object(
      'seq', 3, 'code', 'G-002', 'name', '剪边', 'price', 0.3, 'out_price', 0, 'skill', '裁剪', 'device', '剪边机',
      'category', 'internal', 'status', 'completed', 'completed', true,
      'plan_qty', v_qty, 'completed_qty', v_qty,
      'dispatch_id', '', 'return_qc_id', '', 'outsourcing_status', '', 'pqc_inspection_id', v_pqc_g2_2,
      'reports', jsonb_build_array(
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 80, 'quantity', 80, 'unit_price', 0.3, 'amount', round(80 * 0.3, 2), 'operator_id', '2d27fcc9-b23c-4da6-8d2f-455bbb55da9f', 'operator_name', '王建国', 'report_time', '2026-08-30T21:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 70, 'quantity', 70, 'unit_price', 0.3, 'amount', round(70 * 0.3, 2), 'operator_id', '0ff9a248-2418-42db-92fd-28b2c60de100', 'operator_name', '张卫国', 'report_time', '2026-09-01T08:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 60, 'quantity', 60, 'unit_price', 0.3, 'amount', round(60 * 0.3, 2), 'operator_id', 'cefb9e56-a0b0-4746-a6e5-82c3f50eb051', 'operator_name', '陈海涛', 'report_time', '2026-09-03T09:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 50, 'quantity', 50, 'unit_price', 0.3, 'amount', round(50 * 0.3, 2), 'operator_id', 'LNBlSBh_3qKq2PIIft9ju', 'operator_name', '于娟英', 'report_time', '2026-09-05T14:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工'),
        jsonb_build_object('id', gen_random_uuid()::text, 'operation_code', 'G-002', 'operation_name', '剪边', 'qty', 40, 'quantity', 40, 'unit_price', 0.3, 'amount', round(40 * 0.3, 2), 'operator_id', 'fff9befe-ba47-4490-b010-1623b76b291f', 'operator_name', '马志强', 'report_time', '2026-09-06T11:00:00+08:00', 'work_no', 'WO-2026-0016-2', 'spec', '112×106英寸 + 20×36英寸×2', 'color', '米色', 'remark', '计件报工')
      )
    ),
    jsonb_build_object('seq',4,'code','G-003','name','包边','price',0.6,'out_price',0,'skill','缝制','device','包边机','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',5,'code','G-010','name','水洗','price',0,'out_price',1,'skill','水洗','device','水洗机','category','outsourcing','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','pending','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',6,'code','G-011','name','检验','price',0.5,'out_price',0,'skill','','device','','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',7,'code','G-006','name','修补','price',0.4,'out_price',0,'skill','缝制','device','平缝机','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb),
    jsonb_build_object('seq',8,'code','G-007','name','包装','price',0.3,'out_price',0,'skill','包装','device','包装线','category','internal','status','pending','completed',false,'plan_qty',v_qty,'completed_qty',0,'dispatch_id','','return_qc_id','','outsourcing_status','','pqc_inspection_id',gen_random_uuid()::text,'reports','[]'::jsonb)
  );

  -- 更新 entity_store work_orders
  UPDATE entity_store SET data = data
    || jsonb_build_object('plan_quantity', v_qty, 'completed_quantity', v_qty, 'progress', 38, 'picking_status', 'completed', 'operations', v_ops1, 'updated_at', now())
  WHERE id = v_wo1_es_id AND entity_type = 'work_orders';
  UPDATE entity_store SET data = data
    || jsonb_build_object('plan_quantity', v_qty, 'completed_quantity', v_qty, 'progress', 38, 'picking_status', 'completed', 'operations', v_ops2, 'updated_at', now())
  WHERE id = v_wo2_es_id AND entity_type = 'work_orders';

  -- 6. 更新物理表 work_orders
  SELECT id INTO v_wo1_phys_id FROM work_orders WHERE work_no = 'WO-2026-0016-1';
  SELECT id INTO v_wo2_phys_id FROM work_orders WHERE work_no = 'WO-2026-0016-2';
  UPDATE work_orders SET plan_quantity = v_qty, completed_quantity = v_qty, progress = 38, status = 'running', operations = v_ops1, updated_at = now()
  WHERE id = v_wo1_phys_id;
  UPDATE work_orders SET plan_quantity = v_qty, completed_quantity = v_qty, progress = 38, status = 'running', operations = v_ops2, updated_at = now()
  WHERE id = v_wo2_phys_id;

  -- 7. 更新外协发/回/付款数量
  UPDATE outsource_shipments SET shipment_quantity = v_qty, updated_at = now() WHERE work_order_no IN ('WO-2026-0016-1','WO-2026-0016-2');
  UPDATE outsource_returns SET return_quantity = v_qty, qualified_quantity = v_qty - defective_quantity, updated_at = now()
  WHERE work_order_no IN ('WO-2026-0016-1','WO-2026-0016-2');
  UPDATE outsource_processing_payments SET quantity = v_qty, amount = v_qty * 2, updated_at = now()
  WHERE work_order_no IN ('WO-2026-0016-1','WO-2026-0016-2');

  -- 8. 生产领料单 + 出库记录
  -- WO-2026-0016-1 希腊绒机绗被
  v_mr_id := gen_random_uuid()::text;
  v_mr_code := 'MR-2026-' || LPAD((floor(random()*9000+1000))::int::text, 4, '0');
  INSERT INTO entity_store (id, entity_type, data) VALUES (v_mr_id, 'material_requisitions', jsonb_build_object(
    'id', v_mr_id, 'code', v_mr_code, 'work_order_id', v_wo1_es_id, 'work_order_no', 'WO-2026-0016-1',
    'contract_no', '26JLHD014', 'related_work_order_no', 'WO-2026-0016-1', 'applicant', '应巧凤',
    'department', '生产部', 'status', 'completed', 'required_date', '2026-08-25',
    'issued_at', '2026-08-25 09:00:00', 'created_at', '2026-08-25 09:00:00', 'updated_at', now(),
    'remark', '按工单BOM发料',
    'items', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-a-greek-220','material_code','MAT-A-GREEK-220','material_name','A#220g希腊绒','unit','m','color','','required_qty',2016.60,'issued_qty',2016.60,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-b-cotton-40s','material_code','MAT-B-COTTON-40S','material_name','B#40S110/90棉布','unit','m','color','','required_qty',906.00,'issued_qty',906.00,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-nonwoven-25g','material_code','MAT-NONWOVEN-25G','material_name','25g无纺布','unit','m','color','','required_qty',75.60,'issued_qty',75.60,'warehouse','辅料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-c150-down','material_code','MAT-C150-DOWN','material_name','150g羽丝棉','unit','kg','color','','required_qty',375.30,'issued_qty',375.30,'warehouse','填充仓','specification','')
    )
  ));
  FOR v_item IN SELECT * FROM jsonb_array_elements((SELECT data->'items' FROM entity_store WHERE id = v_mr_id AND entity_type='material_requisitions')) LOOP
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'record_no', 'MO-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
      'type', 'out', 'subtype', '生产领料', 'material_id', v_item->>'material_id', 'material_code', v_item->>'material_code',
      'material_name', v_item->>'material_name', 'quantity', (v_item->>'issued_qty')::numeric, 'unit', v_item->>'unit',
      'warehouse', v_item->>'warehouse', 'handler', '仓库管理员', 'record_date', '2026-08-25',
      'related_order', 'WO-2026-0016-1', 'related_order_id', v_wo1_es_id, 'contract_no', '26JLHD014',
      'remark', '工单发料', 'created_at', '2026-08-25T09:00:00+08:00'
    ));
  END LOOP;

  -- WO-2026-0016-2 纯棉素色密绗被
  v_mr_id := gen_random_uuid()::text;
  v_mr_code := 'MR-2026-' || LPAD((floor(random()*9000+1000))::int::text, 4, '0');
  INSERT INTO entity_store (id, entity_type, data) VALUES (v_mr_id, 'material_requisitions', jsonb_build_object(
    'id', v_mr_id, 'code', v_mr_code, 'work_order_id', v_wo2_es_id, 'work_order_no', 'WO-2026-0016-2',
    'contract_no', '26JLHD014', 'related_work_order_no', 'WO-2026-0016-2', 'applicant', '应巧凤',
    'department', '生产部', 'status', 'completed', 'required_date', '2026-08-25',
    'issued_at', '2026-08-25 09:00:00', 'created_at', '2026-08-25 09:00:00', 'updated_at', now(),
    'remark', '按工单BOM发料',
    'items', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-cotton-32s','material_code','MAT-COTTON-32S','material_name','32S68×62全棉素色布','unit','m','color','米色','required_qty',1017.00,'issued_qty',1017.00,'warehouse','面料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-nonwoven-25g','material_code','MAT-NONWOVEN-25G','material_name','25g无纺布','unit','m','color','米色','required_qty',954.00,'issued_qty',954.00,'warehouse','辅料仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-c200-cotton','material_code','MAT-C200-COTTON','material_name','200g 90%漂白针刺棉','unit','kg','color','米色','required_qty',579.00,'issued_qty',579.00,'warehouse','填充仓','specification',''),
      jsonb_build_object('id', gen_random_uuid()::text, 'material_id','mat-quilt-thread','material_code','MAT-QUILT-THREAD','material_name','配色绗线','unit','万针','color','米色','required_qty',12900.00,'issued_qty',12900.00,'warehouse','辅料仓','specification','')
    )
  ));
  FOR v_item IN SELECT * FROM jsonb_array_elements((SELECT data->'items' FROM entity_store WHERE id = v_mr_id AND entity_type='material_requisitions')) LOOP
    INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
      'id', gen_random_uuid()::text, 'record_no', 'MO-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
      'type', 'out', 'subtype', '生产领料', 'material_id', v_item->>'material_id', 'material_code', v_item->>'material_code',
      'material_name', v_item->>'material_name', 'quantity', (v_item->>'issued_qty')::numeric, 'unit', v_item->>'unit',
      'warehouse', v_item->>'warehouse', 'handler', '仓库管理员', 'record_date', '2026-08-25',
      'related_order', 'WO-2026-0016-2', 'related_order_id', v_wo2_es_id, 'contract_no', '26JLHD014',
      'remark', '工单发料', 'created_at', '2026-08-25T09:00:00+08:00'
    ));
  END LOOP;

  -- 9. 外协回货入库记录
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
    'id', gen_random_uuid()::text, 'record_no', 'WI-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
    'type', 'in', 'subtype', '外协回货入库', 'product_id', 'product-sz98870', 'product_code', 'SZ98870', 'product_name', '希腊绒机绗被',
    'sku_id', 'sz98870-ok', 'quantity', v_qty, 'warehouse', '外协仓', 'handler', '仓库管理员', 'record_date', '2026-08-31',
    'related_order', 'WO-2026-0016-1', 'related_order_id', v_wo1_es_id, 'contract_no', '26JLHD014',
    'remark', '电脑绣外协回货', 'created_at', '2026-08-31T16:00:00+08:00'
  ));
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'stock_records', jsonb_build_object(
    'id', gen_random_uuid()::text, 'record_no', 'WI-'||LPAD((floor(random()*900000+100000))::int::text,6,'0'),
    'type', 'in', 'subtype', '外协回货入库', 'product_id', 'product-sz26008', 'product_code', 'SZ26008', 'product_name', '纯棉素色密绗被',
    'sku_id', 'sz26008-ok', 'quantity', v_qty, 'warehouse', '外协仓', 'handler', '仓库管理员', 'record_date', '2026-08-31',
    'related_order', 'WO-2026-0016-2', 'related_order_id', v_wo2_es_id, 'contract_no', '26JLHD014',
    'remark', '电脑绣外协回货', 'created_at', '2026-08-31T16:00:00+08:00'
  ));

  -- 10. 剪边完成后半成品入库 + 库存更新
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'finished_goods_inbounds', jsonb_build_object(
    'id', gen_random_uuid()::text, 'inbound_no', 'RKS-26JLHD014-'||LPAD((floor(random()*900+100))::int::text,3,'0'),
    'work_id', v_wo1_es_id, 'work_no', 'WO-2026-0016-1', 'product_id', 'product-sz98870', 'product_code', 'SZ98870', 'product_name', '希腊绒机绗被',
    'quantity', v_qty, 'warehouse', '半成品仓', 'location_id', 'loc-semi-1', 'status', 'inbound',
    'inbound_date', '2026-09-06T18:00:00+08:00', 'contract_no', '26JLHD014', 'created_at', '2026-09-06T18:00:00+08:00'
  ));
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'finished_goods_inbounds', jsonb_build_object(
    'id', gen_random_uuid()::text, 'inbound_no', 'RKS-26JLHD014-'||LPAD((floor(random()*900+100))::int::text,3,'0'),
    'work_id', v_wo2_es_id, 'work_no', 'WO-2026-0016-2', 'product_id', 'product-sz26008', 'product_code', 'SZ26008', 'product_name', '纯棉素色密绗被',
    'quantity', v_qty, 'warehouse', '半成品仓', 'location_id', 'loc-semi-1', 'status', 'inbound',
    'inbound_date', '2026-09-06T18:00:00+08:00', 'contract_no', '26JLHD014', 'created_at', '2026-09-06T18:00:00+08:00'
  ));
  UPDATE entity_store SET data = data || jsonb_build_object('quantity', v_qty, 'updated_at', now())
  WHERE entity_type='inventory' AND data->>'warehouse'='半成品仓' AND data->>'product_id'='product-sz98870';
  UPDATE entity_store SET data = data || jsonb_build_object('quantity', v_qty, 'updated_at', now())
  WHERE entity_type='inventory' AND data->>'warehouse'='半成品仓' AND data->>'product_id'='product-sz26008';

  -- 11. 过程检验记录
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections', jsonb_build_object(
    'id', v_pqc_g1_1, 'code', 'PI-26JLHD014-801', 'contract_no', '26JLHD014', 'work_id', v_wo1_es_id, 'work_no', 'WO-2026-0016-1',
    'work_order_id', v_wo1_es_id, 'work_order_no', 'WO-2026-0016-1', 'operation_code', 'G-001', 'operation_name', '开料',
    'product_code', 'SZ98870', 'product_name', '希腊绒机绗被', 'color', '', 'check_date', '2026-08-27',
    'check_qty', v_qty, 'qualified_qty', v_qty, 'unqualified_qty', 0,
    'qualified_rate', '100%', 'result', 'qualified', 'status', 'inspected',
    'defect_reason', '', 'inspector', '金灵芳', 'created_at', '2026-08-27T18:00:00+08:00', 'updated_at', now()
  ));
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections', jsonb_build_object(
    'id', v_pqc_g8_1, 'code', 'PI-26JLHD014-802', 'contract_no', '26JLHD014', 'work_id', v_wo1_es_id, 'work_no', 'WO-2026-0016-1',
    'work_order_id', v_wo1_es_id, 'work_order_no', 'WO-2026-0016-1', 'operation_code', 'G-008', 'operation_name', '电脑绣',
    'product_code', 'SZ98870', 'product_name', '希腊绒机绗被', 'color', '', 'check_date', '2026-08-31',
    'check_qty', v_qty, 'qualified_qty', v_qty - 1, 'unqualified_qty', 1,
    'qualified_rate', round((v_qty-1)::numeric/v_qty*100,2)::text||'%', 'result', 'partial', 'status', 'inspected',
    'defect_reason', '外观轻微瑕疵', 'inspector', '张卫国', 'created_at', '2026-08-31T16:00:00+08:00', 'updated_at', now()
  ));
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections', jsonb_build_object(
    'id', v_pqc_g2_1, 'code', 'PI-26JLHD014-803', 'contract_no', '26JLHD014', 'work_id', v_wo1_es_id, 'work_no', 'WO-2026-0016-1',
    'work_order_id', v_wo1_es_id, 'work_order_no', 'WO-2026-0016-1', 'operation_code', 'G-002', 'operation_name', '剪边',
    'product_code', 'SZ98870', 'product_name', '希腊绒机绗被', 'color', '', 'check_date', '2026-09-06',
    'check_qty', v_qty, 'qualified_qty', v_qty, 'unqualified_qty', 0,
    'qualified_rate', '100%', 'result', 'qualified', 'status', 'inspected',
    'defect_reason', '', 'inspector', '方自伟', 'created_at', '2026-09-06T18:00:00+08:00', 'updated_at', now()
  ));
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections', jsonb_build_object(
    'id', v_pqc_g1_2, 'code', 'PI-26JLHD014-804', 'contract_no', '26JLHD014', 'work_id', v_wo2_es_id, 'work_no', 'WO-2026-0016-2',
    'work_order_id', v_wo2_es_id, 'work_order_no', 'WO-2026-0016-2', 'operation_code', 'G-001', 'operation_name', '开料',
    'product_code', 'SZ26008', 'product_name', '纯棉素色密绗被', 'color', '米色', 'check_date', '2026-08-27',
    'check_qty', v_qty, 'qualified_qty', v_qty, 'unqualified_qty', 0,
    'qualified_rate', '100%', 'result', 'qualified', 'status', 'inspected',
    'defect_reason', '', 'inspector', '金灵芳', 'created_at', '2026-08-27T18:00:00+08:00', 'updated_at', now()
  ));
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections', jsonb_build_object(
    'id', v_pqc_g8_2, 'code', 'PI-26JLHD014-805', 'contract_no', '26JLHD014', 'work_id', v_wo2_es_id, 'work_no', 'WO-2026-0016-2',
    'work_order_id', v_wo2_es_id, 'work_order_no', 'WO-2026-0016-2', 'operation_code', 'G-008', 'operation_name', '电脑绣',
    'product_code', 'SZ26008', 'product_name', '纯棉素色密绗被', 'color', '米色', 'check_date', '2026-08-31',
    'check_qty', v_qty, 'qualified_qty', v_qty, 'unqualified_qty', 0,
    'qualified_rate', '100%', 'result', 'qualified', 'status', 'inspected',
    'defect_reason', '', 'inspector', '方自伟', 'created_at', '2026-08-31T16:00:00+08:00', 'updated_at', now()
  ));
  INSERT INTO entity_store (id, entity_type, data) VALUES (gen_random_uuid()::text, 'process_inspections', jsonb_build_object(
    'id', v_pqc_g2_2, 'code', 'PI-26JLHD014-806', 'contract_no', '26JLHD014', 'work_id', v_wo2_es_id, 'work_no', 'WO-2026-0016-2',
    'work_order_id', v_wo2_es_id, 'work_order_no', 'WO-2026-0016-2', 'operation_code', 'G-002', 'operation_name', '剪边',
    'product_code', 'SZ26008', 'product_name', '纯棉素色密绗被', 'color', '米色', 'check_date', '2026-09-06',
    'check_qty', v_qty, 'qualified_qty', v_qty, 'unqualified_qty', 0,
    'qualified_rate', '100%', 'result', 'qualified', 'status', 'inspected',
    'defect_reason', '', 'inspector', '金灵芳', 'created_at', '2026-09-06T18:00:00+08:00', 'updated_at', now()
  ));

  -- 12. 重新聚合 2026-09 计件工资（仅剪边 9 月部分）
  SELECT jsonb_object_agg(s.wid, s.amt) INTO v_salary FROM (
    SELECT r->>'operator_id' AS wid, SUM((r->>'amount')::numeric) AS amt
    FROM entity_store e, jsonb_array_elements(e.data->'operations') o, jsonb_array_elements(o->'reports') r
    WHERE e.entity_type='work_orders' AND e.data->>'contract_no'='26JLHD014'
      AND o->>'code' = 'G-002' AND r->>'report_time' >= '2026-09-01'
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