BEGIN; DO $$
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
END $$; COMMIT;